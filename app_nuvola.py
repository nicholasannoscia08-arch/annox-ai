import time
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import cervello

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
LIMITE_PERSONA = 15
LIMITE_TOTALE = 80
richieste = {}


class Messaggio(BaseModel):
    testo: str


def ip_di(request):
    for nome in ("cf-connecting-ip", "x-forwarded-for"):
        v = request.headers.get(nome, "").split(",")[0].strip()
        if v:
            return v
    return request.client.host if request.client else "?"


@app.get("/")
def radice():
    return RedirectResponse("/nexus/")


@app.get("/salute")
def salute():
    return {"ok": True}


@app.get("/ruolo")
def ruolo():
    return {"ruolo": "ospite"}


@app.get("/storico")
def storico():
    return []


@app.post("/chiedi")
def chiedi(request: Request, messaggio: Messaggio):
    ip = ip_di(request)
    ora = time.time()
    mie = [t for t in richieste.get(ip, []) if ora - t < 3600]
    tutte = [t for t in richieste.get("*", []) if ora - t < 3600]
    if len(mie) >= LIMITE_PERSONA or len(tutte) >= LIMITE_TOTALE:
        return JSONResponse({"detail": "Limite di richieste della demo raggiunto: riprova più tardi."}, status_code=429)
    mie.append(ora)
    tutte.append(ora)
    richieste[ip] = mie
    richieste["*"] = tutte
    return {"risposta": cervello.elabora_ospite(messaggio.testo, request.headers.get("x-sess", ip))}


app.mount("/nexus", StaticFiles(directory="nexus", html=True), name="nexus")
