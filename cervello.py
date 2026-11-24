import os
import json
import re
import time
import sqlite3
import threading
from datetime import date
from dotenv import load_dotenv
from groq import Groq
from ddgs import DDGS

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODELLO = "openai/gpt-oss-120b"
MESSAGGI_RICORDATI = 20

db = sqlite3.connect("memoria.db", check_same_thread=False)
db.execute("CREATE TABLE IF NOT EXISTS conversazione (id INTEGER PRIMARY KEY AUTOINCREMENT, ruolo TEXT, testo TEXT)")
db.execute("CREATE TABLE IF NOT EXISTS fatti (id INTEGER PRIMARY KEY AUTOINCREMENT, testo TEXT)")
db.commit()
blocco = threading.Lock()


def carica_fatti():
    return [r[0] for r in db.execute("SELECT testo FROM fatti ORDER BY id")]


def carica_conversazione():
    righe = db.execute(
        "SELECT ruolo, testo FROM conversazione ORDER BY id DESC LIMIT ?",
        (MESSAGGI_RICORDATI,),
    ).fetchall()
    righe.reverse()
    return [{"role": ruolo, "content": testo} for ruolo, testo in righe]


def salva_messaggio(ruolo, testo):
    db.execute("INSERT INTO conversazione (ruolo, testo) VALUES (?, ?)", (ruolo, testo))
    db.commit()


def istruzioni(domanda=""):
    if ospite_attivo["v"]:
        return testo_ospite()
    base = (
        "Sei ANNOX AI, un assistente personale professionale, preciso e diretto. Non fare battute, citazioni di film o riferimenti a personaggi di fantasia, a meno che io non lo chieda. "
        "Rispondi sempre in italiano, in modo chiaro e conciso. "
        "Oggi è il " + date.today().isoformat() + ". "
        "Quando serve un'informazione aggiornata (notizie, meteo, prezzi, fatti recenti, "
        "qualcosa che potresti non sapere) usa lo strumento cerca_sul_web, "
        "poi rispondi in base ai risultati e indica brevemente la fonte."
    )
    fatti = carica_fatti()
    if fatti:
        base += "\n\nCose che sai sull'utente, ricordate da conversazioni precedenti:\n"
        base += "\n".join("- " + f for f in fatti)
    if documento["testo"]:
        base += "\n\nL'utente ha allegato il file «" + documento["nome"] + "». Contenuto:\n" + estratti(domanda)
    return base


def cerca_sul_web(domanda):
    try:
        risultati = DDGS().text(domanda, region="it-it", max_results=5)
    except Exception as errore:
        return "Ricerca non riuscita: " + str(errore)
    if not risultati:
        return "Nessun risultato trovato."
    return "\n\n".join(
        r.get("title", "") + "\n" + r.get("body", "")[:500] + "\n" + r.get("href", "")
        for r in risultati
    )


STRUMENTI = [
    {
        "type": "function",
        "function": {
            "name": "cerca_sul_web",
            "description": "Cerca informazioni aggiornate su internet.",
            "parameters": {
                "type": "object",
                "properties": {
                    "domanda": {
                        "type": "string",
                        "description": "Le parole da cercare sul web",
                    }
                },
                "required": ["domanda"],
            },
        },
    }
]


MODELLI = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]


LIMITI_TPM = {"openai/gpt-oss-120b": 8000, "openai/gpt-oss-20b": 8000}
RISERVA = 1500
MINIMO = 1500
usi = {}


def stima(msgs):
    return int(len(json.dumps(msgs, ensure_ascii=False)) / 3.5) + 250


def libero(modello):
    ora = time.time()
    usi[modello] = [(t, n) for t, n in usi.get(modello, []) if ora - t < 60]
    return LIMITI_TPM.get(modello, 8000) - sum(n for t, n in usi[modello])


def registra(modello, risposta):
    try:
        usi.setdefault(modello, []).append((time.time(), risposta.usage.total_tokens))
    except Exception:
        pass


def attesa_da(testo):
    m = re.search(r"try again in (?:(\d+)m)?\s*([0-9.]+)(ms|s)", testo)
    if not m:
        return None
    sec = float(m.group(2)) / (1000 if m.group(3) == "ms" else 1)
    return (int(m.group(1)) * 60 if m.group(1) else 0) + sec


def adatta(messaggi, budget):
    msgs = [dict(m) for m in messaggi]
    iu = max(i for i, m in enumerate(msgs) if m["role"] == "user")
    base, storia, coda = msgs[0], msgs[1:iu], msgs[iu:]
    usato = stima([base] + coda)
    tenuti = []
    for m in reversed(storia):
        peso = stima([m]) - 250
        if usato + peso > budget:
            break
        tenuti.insert(0, m)
        usato += peso
    while tenuti and tenuti[0]["role"] != "user":
        tenuti.pop(0)
    ris = [base] + tenuti + coda
    for _ in range(10):
        if stima(ris) <= budget:
            break
        ultimo = len(ris) - len(coda)
        cand = [i for i, m in enumerate(ris) if i != ultimo and isinstance(m.get("content"), str) and len(m["content"]) > (1000 if i == 0 else 400)]
        if cand:
            i = max(cand, key=lambda k: len(ris[k]["content"]))
            mn = 1000 if i == 0 else 400
            ris[i]["content"] = ris[i]["content"][:max(mn, int(len(ris[i]["content"]) * 0.6))]
        else:
            c = ris[ultimo]["content"]
            if len(c) <= 400:
                break
            ris[ultimo]["content"] = c[:max(400, int(len(c) * 0.7))] + " [...testo abbreviato per rispettare il limite del modello]"
    return ris


def chiedi(**parametri):
    originali = parametri.pop("messages")
    parametri.pop("model", None)
    ultimo_errore = None
    for giro in range(2):
        attese = []
        for modello in MODELLI:
            budget = max(MINIMO, min(LIMITI_TPM.get(modello, 8000) - RISERVA, libero(modello) - RISERVA))
            messaggi = adatta(originali, budget)
            for tentativo in range(3):
                try:
                    risposta = client.chat.completions.create(model=modello, messages=messaggi, **parametri)
                    registra(modello, risposta)
                    return risposta
                except Exception as errore:
                    testo = str(errore)
                    codice = getattr(errore, "status_code", None)
                    if codice == 413 or (codice is None and "413" in testo):
                        budget = int(budget * 0.6)
                        if budget < 600:
                            ultimo_errore = errore
                            break
                        print("  [richiesta troppo grande per " + modello + ": riduco il contesto]")
                        messaggi = adatta(originali, budget)
                        continue
                    if codice == 429 or "rate_limit" in testo:
                        ultimo_errore = errore
                        a = attesa_da(testo)
                        if a is not None:
                            attese.append(a)
                        print("  [" + modello + " al limite, provo un altro modello]")
                        break
                    raise
        if giro == 0 and attese and min(attese) <= 25:
            print("  [attendo " + str(round(min(attese), 1)) + " s, come indicato da Groq]")
            time.sleep(min(attese) + .5)
        else:
            break
    raise ultimo_errore or RuntimeError("rate_limit: nessun modello disponibile")


def rispondi(cronologia):
    messaggi = [{"role": "system", "content": istruzioni(cronologia[-1]["content"] if cronologia else "")}] + [{"role": m["role"], "content": m["content"]} for m in cronologia]
    for _ in range(3):
        risposta = chiedi(
            model=MODELLO, messages=messaggi, tools=STRUMENTI
        )
        msg = risposta.choices[0].message
        if not msg.tool_calls:
            return msg.content or ""
        messaggi.append(
            {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": c.id,
                        "type": "function",
                        "function": {
                            "name": c.function.name,
                            "arguments": c.function.arguments,
                        },
                    }
                    for c in msg.tool_calls
                ],
            }
        )
        for c in msg.tool_calls:
            argomenti = json.loads(c.function.arguments)
            domanda = argomenti.get("domanda", "")
            print("  [Jarvis sta cercando: " + domanda + "]")
            if c.function.name == "cerca_sul_web":
                risultato = cerca_sul_web(domanda)
            else:
                risultato = "Strumento sconosciuto."
            messaggi.append(
                {"role": "tool", "tool_call_id": c.id, "content": risultato}
            )
    risposta = chiedi(model=MODELLO, messages=messaggi)
    return risposta.choices[0].message.content or ""


cronologia = carica_conversazione()


def storico():
    with blocco:
        return [{"ruolo": m["role"], "testo": m["content"]} for m in cronologia]


def elabora(testo):
    global cronologia
    testo = testo.strip()
    minuscolo = testo.lower()
    if not testo:
        return ""

    with blocco:
        if minuscolo.startswith("ricorda "):
            db.execute("INSERT INTO fatti (testo) VALUES (?)", (testo[8:].strip(),))
            db.commit()
            return "Annotato."

        if minuscolo in ("cosa ricordi", "cosa ricordi?"):
            fatti = carica_fatti()
            if not fatti:
                return "Per ora non ho annotato nulla."
            return "Ecco cosa so:\n" + "\n".join("- " + f for f in fatti)

        if minuscolo == "dimentica tutto":
            db.execute("DELETE FROM conversazione")
            db.execute("DELETE FROM fatti")
            db.commit()
            cronologia = []
            return "Memoria cancellata."

        cronologia.append({"role": "user", "content": testo})
        try:
            risposta = rispondi(cronologia)
        except Exception as errore:
            cronologia.pop()
            return ("Ho raggiunto il limite gratuito di richieste al minuto: riprova tra poco." if "rate_limit" in str(errore) else "Errore: " + str(errore))
        cronologia.append({"role": "assistant", "content": risposta})
        salva_messaggio("user", testo)
        salva_messaggio("assistant", risposta)
        return risposta


MAX_DOC = 9000
documento = {"nome": "", "testo": ""}


def allega(nome, testo):
    documento["nome"] = nome
    documento["testo"] = testo[:300000]


def rimuovi_file():
    documento["nome"] = ""
    documento["testo"] = ""


def estratti(domanda):
    import re
    testo = documento["testo"]
    if len(testo) <= MAX_DOC:
        return testo
    parole = set(re.findall(r"\w{4,}", (domanda or "").lower()))
    blocchi = [testo[i:i + 900] for i in range(0, len(testo), 900)]
    punti = [sum(b.lower().count(p) for p in parole) for b in blocchi]
    scelti = sorted(range(len(blocchi)), key=lambda n: (-punti[n], n))[:10]
    scelti.sort()
    return "\n[...]\n".join(blocchi[n] for n in scelti)


def cancella_cronologia():
    global cronologia
    with blocco:
        db.execute("DELETE FROM conversazione")
        db.commit()
        cronologia = []
    return True


ospite_attivo = {"v": False}
sessioni_ospite = {}


def testo_ospite():
    return (
        "Sei ANNOX AI, un assistente professionale, preciso e diretto. Rispondi sempre in italiano, in modo chiaro e conciso. "
        "Non fare battute, citazioni di film o riferimenti a personaggi di fantasia, a meno che l'utente lo chieda. "
        "Oggi è il " + date.today().isoformat() + ". "
        "Quando serve un'informazione aggiornata usa lo strumento cerca_sul_web e indica brevemente la fonte. "
        "Questa è una sessione dimostrativa: non hai accesso a file, ricordi o dati personali di nessuno."
    )


def elabora_ospite(testo, sessione):
    testo = (testo or "").strip()[:1500]
    if not testo:
        return ""
    with blocco:
        ospite_attivo["v"] = True
        try:
            sessione = (sessione or "anonimo")[:64]
            if len(sessioni_ospite) > 50 and sessione not in sessioni_ospite:
                sessioni_ospite.pop(next(iter(sessioni_ospite)))
            cr = sessioni_ospite.setdefault(sessione, [])
            cr.append({"role": "user", "content": testo})
            try:
                risposta = rispondi(cr)
            except Exception as errore:
                cr.pop()
                if "rate_limit" in str(errore):
                    return "Il servizio dimostrativo ha raggiunto il limite gratuito del momento: riprova tra poco."
                return "Si è verificato un errore: riprova tra poco."
            cr.append({"role": "assistant", "content": risposta})
            del cr[:-12]
            return risposta
        finally:
            ospite_attivo["v"] = False
