#!/usr/bin/env python3
"""Fuente única de verdad del sitio.

De acá salen, por generación, dos cosas que de otro modo se desincronizan:

  1. produccion/prompts/*.txt  — los prompts, por si algún día se genera con AI
  2. sitio/public/media/js/contenido.js — el contenido bilingüe del motor

Editar acá y correr `python3 produccion/escenas.py`. Nunca editar la salida.

GUION: el ascenso al Villarrica en 4 escenas. El scroll ES subir el cerro.
Arquitectura A de la skill (recorrido continuo hacia adelante, sin conectores):
la cámara nunca retrocede, así que no hay el tartamudeo de las costuras del
formato catálogo. Los otros volcanes del catálogo van más abajo en la página,
con fotos, no con clips.
"""

import json
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent

PALETA = {
    "obsidiana": "#14110F",
    "lava":      "#D64A1E",
    "azufre":    "#E8B33C",
    "araucaria": "#2F5D4A",
    "lago":      "#3A7CA5",
    "nieve":     "#F2EDE6",
}

# Preámbulo de estilo, solo relevante si algún día se genera con AI en vez de
# usar fotografía. Se mantiene para no perder el trabajo hecho.
PREAMBULO = (
    "Cinematic photoreal aerial footage of the Villarrica volcano in Pucón, Chile, "
    "in winter with the cone fully snow-covered. Palette: deep blue sky, white snow, "
    "black basalt, golden low sun. No text, no letters, no logos, 16:9."
)

ESCENAS = [
    {
        "id": "lago",
        "acento": PALETA["lago"],
        "scroll": 1.6, "linger": 0.42,
        "label": {"es": "El lago", "en": "The lake"},
        "sujeto": ("The Villarrica volcano seen from the Pucón lakefront, fully "
                   "snow-covered, the lake and the moored boats in front of it"),
        "copy": {
            "es": {
                "eyebrow": "Pucón · 2.847 m",
                "title": "El volcán que todavía respira.",
                "body": "Lo ves desde la costanera, blanco y entero. En seis horas vas a "
                        "estar mirando dentro del cráter.",
                "tags": ["1 guía cada 3", "Equipo incluido", "Salida al amanecer"],
            },
            "en": {
                "eyebrow": "Pucón · 2,847 m",
                "title": "The volcano that still breathes.",
                "body": "You see it from the lakefront, white and whole. In six hours "
                        "you'll be looking down into its crater.",
                "tags": ["1 guide per 3", "Gear included", "Dawn departure"],
            },
        },
    },
    {
        "id": "ascenso",
        "acento": PALETA["nieve"],
        "scroll": 1.6, "linger": 0.40,
        "label": {"es": "El ascenso", "en": "The climb"},
        "sujeto": ("A roped line of climbers ascending the snow face of the Villarrica "
                   "at dawn, pink alpenglow on the upper cone"),
        "copy": {
            "es": {
                "eyebrow": "Cuatro horas de nieve",
                "title": "Se sube con crampones y piolet.",
                "body": "Un guía cada tres personas. El ritmo lo pone el grupo, no el "
                        "reloj: nadie se queda atrás.",
                "tags": ["~1.400 m de desnivel", "Exigente", "Crampones y piolet"],
            },
            "en": {
                "eyebrow": "Four hours on snow",
                "title": "Crampons and an ice axe.",
                "body": "One guide per three climbers. The group sets the pace, not the "
                        "clock — nobody gets left behind.",
                "tags": ["~1,400 m ascent", "Demanding", "Crampons and ice axe"],
            },
        },
    },
    {
        "id": "crater",
        "acento": PALETA["lava"],
        "scroll": 1.8, "linger": 0.48,
        "label": {"es": "El cráter", "en": "The crater"},
        "sujeto": ("The open summit crater of the Villarrica from the air, steaming "
                   "fumarole, ash and sulphur, snowfields and other volcanoes beyond"),
        "copy": {
            "es": {
                "eyebrow": "2.847 m · La cumbre",
                "title": "Te asomas al cráter.",
                "body": "Seis horas de nieve para llegar al borde y mirar dentro. Abajo "
                        "humea. Y después se baja deslizando.",
                "tags": ["Fumarola activa", "El descenso deslizando"],
            },
            "en": {
                "eyebrow": "2,847 m · The summit",
                "title": "You look into the crater.",
                "body": "Six hours on snow to reach the rim and look in. It steams down "
                        "there. And then you slide back down.",
                "tags": ["Active fumarole", "The slide down"],
            },
        },
    },
    {
        "id": "base",
        "acento": PALETA["azufre"],
        "scroll": 1.9, "linger": 0.50,
        "label": {"es": "Reservar", "en": "Book"},
        "sujeto": ("The Villarrica cone at golden hour seen from the forest below, warm "
                   "low sunlight raking across the snow"),
        "copy": {
            "es": {
                "eyebrow": "Reserva directa",
                "title": "Terra Volcano te sube.",
                "body": "Once años guiando en estos cerros, equipo propio y un guía cada "
                        "tres personas. Reservas directo con ellos, sin intermediarios.",
                "tags": ["Acreditado en Pucón", "Equipo incluido",
                         "Si el clima cancela, reagendamos"],
                "cta": {
                    "primary":   {"label": "Reservar por WhatsApp", "href": "#CONFIRMAR-WHATSAPP"},
                    "secondary": {"label": "¿Puedo hacerlo?", "href": "#exigencia"},
                },
            },
            "en": {
                "eyebrow": "Book direct",
                "title": "Terra Volcano takes you up.",
                "body": "Eleven years guiding these mountains, their own gear, and one "
                        "guide per three climbers. You book straight with them, no middleman.",
                "tags": ["Pucón accredited", "Gear included", "Weather cancels, we rebook"],
                "cta": {
                    "primary":   {"label": "Book on WhatsApp", "href": "#CONFIRMAR-WHATSAPP"},
                    "secondary": {"label": "Can I do this?", "href": "#exigencia"},
                },
            },
        },
    },
]

MARCA = {
    "es": {"hint": "scroll para subir", "tagline": "Expediciones en la Araucanía andina"},
    "en": {"hint": "scroll to climb",   "tagline": "Expeditions in the Andean Araucanía"},
}


def escribir_prompts():
    destino = RAIZ / "produccion" / "prompts"
    destino.mkdir(parents=True, exist_ok=True)
    for viejo in destino.glob("*.txt"):
        viejo.unlink()
    for i, e in enumerate(ESCENAS):
        (destino / f"{i}-{e['id']}-still.txt").write_text(
            f"{PREAMBULO} Subject: {e['sujeto']}.\n", encoding="utf-8")
        # Arquitectura A: cada tramo arranca del ÚLTIMO frame real del anterior y
        # nunca lleva end-image. Un end-image de un plano general obliga a la
        # cámara a retroceder, que es la causa número uno del tartamudeo.
        cont = ("Continue gliding smoothly FORWARD and UPWARD into " if i else
                "Single continuous cinematic camera move, no cuts, gliding forward into ")
        (destino / f"{i}-{e['id']}-tramo.txt").write_text(
            f"{cont}{e['sujeto']}, never pulling back. {PREAMBULO} The shot ends by "
            "settling into a slow, steady forward drift. Smooth, graceful, slow motion. "
            "No text, no captions.\n", encoding="utf-8")
    return destino


def escribir_contenido():
    secciones = [{
        "id": e["id"], "accent": e["acento"], "scroll": e["scroll"], "linger": e["linger"],
        # Rutas relativas a sitio/public/villarrica/, que es desde donde se
        # sirve la landing. Si la landing cambia de carpeta, cambian acá.
        "still": f"../media/stills/{e['id']}.jpg",
        "clip":  f"../media/vid/{e['id']}.mp4",
        "label": e["label"], "copy": e["copy"],
    } for e in ESCENAS]

    datos = {"marca": MARCA, "secciones": secciones,
             # Arquitectura A: sin conectores. Los tramos SON el recorrido.
             "conectores": [], "paleta": PALETA}

    destino = RAIZ / "sitio" / "public" / "media" / "js" / "contenido.js"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(
        "/* GENERADO por produccion/escenas.py — no editar a mano. */\n"
        "window.TV_CONTENIDO = " +
        json.dumps(datos, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    return destino


if __name__ == "__main__":
    p = escribir_prompts()
    c = escribir_contenido()
    print(f"{len(list(p.glob('*.txt')))} prompts en {p.relative_to(RAIZ)}")
    print(f"contenido en {c.relative_to(RAIZ)}")
