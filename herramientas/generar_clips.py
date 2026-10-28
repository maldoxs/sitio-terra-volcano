#!/usr/bin/env python3
"""Genera los clips del vuelo a partir de las fotografías reales del Villarrica.

No hay AI acá. Cada escena es una fotografía con un movimiento de cámara lento
aplicado con ffmpeg, y el motor la scrubea según el scroll. Es la misma técnica
de las páginas scroll-through de Apple: el video está pre-renderizado, el scroll
solo mueve el tiempo.

Cuando haya metraje de drone real —que es el objetivo— se reemplazan los .mp4
de public/media/vid/ con los mismos nombres y la página no cambia una línea.

Uso:  python3 herramientas/generar_clips.py
"""

import pathlib
import subprocess
import sys

from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
REF = RAIZ / "herramientas" / "referencias"
sys.path.insert(0, str(RAIZ / "herramientas"))
from escenas import ESCENAS  # noqa: E402

W, H = 1280, 720          # el material de origen no da para 1080p honesto
FPS, DUR = 24, 10

# Por escena: foto de origen, recorte 16:9 (x, y, ancho, alto) y movimiento.
# El recorte evita además los overlays de interfaz de las capturas.
FUENTES = {
    "lago":    ("ref-costanera-lago.webp",  (0, 400, 1396, 785),  "subir"),
    "ascenso": ("ref-cordada-ascenso.webp", (0, 60, 1082, 609),   "subir"),
    "crater":  ("ref-crater-aereo.webp",    (300, 330, 1600, 900), "entrar"),
    "base":    ("ref-cono-atardecer.webp",  (0, 150, 1318, 741),  "alejar"),
}

# Parches: zonas donde una captura de pantalla dejó interfaz encima de la foto.
# Se tapan copiando la franja CONTIGUA A LA IZQUIERDA, no la de arriba: en un
# paisaje la textura es continua en horizontal (la línea de árboles sigue) pero
# no en vertical (arriba hay cielo, y el parche se ve como un bloque).
PARCHES = {
    "ref-costanera-lago.webp": [(1004, 662, 1262, 708)],   # "Mostrar a tamaño real"
}


def preparar(nombre, caja):
    im = Image.open(REF / nombre).convert("RGB")
    for (x0, y0, x1, y1) in PARCHES.get(nombre, []):
        ancho = x1 - x0
        im.paste(im.crop((x0 - ancho, y0, x0, y1)), (x0, y0))
    x, y, w, h = caja
    im = im.crop((x, y, x + w, y + h))
    # Se trabaja al doble del ancho de salida: el zoompan interpola mejor y el
    # movimiento no se ve escalonado.
    return im.resize((W * 2, round(W * 2 * h / w)), Image.LANCZOS)


MOVIMIENTOS = {
    # z = zoom, y = deriva vertical. Todos avanzan: ninguno retrocede a mitad de
    # camino, que es lo que haría tartamudear la costura al scrollear.
    "subir":  ("1+0.16*on/{n}", "ih/2-(ih/zoom/2)-(ih*0.05*on/{n})"),
    "entrar": ("1+0.22*on/{n}", "ih/2-(ih/zoom/2)+(ih*0.03*on/{n})"),
    "alejar": ("1.18-0.16*on/{n}", "ih/2-(ih/zoom/2)"),
}

ENC = ["-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p",
       "-g", "10", "-keyint_min", "10", "-sc_threshold", "0", "-movflags", "+faststart", "-an"]


def ff(args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def main():
    sd = RAIZ / "public" / "media" / "stills"
    vd = RAIZ / "public" / "media" / "vid"
    tmp = RAIZ / "herramientas" / ".tmp"
    for p in (sd, vd, tmp):
        p.mkdir(parents=True, exist_ok=True)
    for viejo in list(sd.glob("*")) + list(vd.glob("*")):
        viejo.unlink()

    n = DUR * FPS
    for e in ESCENAS:
        nombre, caja, mov = FUENTES[e["id"]]
        base = tmp / f"{e['id']}.png"
        preparar(nombre, caja).save(base)

        z, yy = (s.format(n=n) for s in MOVIMIENTOS[mov])
        ff(["-loop", "1", "-i", str(base), "-t", str(DUR), "-r", str(FPS),
            "-vf", (f"zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='{yy}':"
                    f"d=1:s={W}x{H}:fps={FPS},"
                    "unsharp=5:5:0.6:5:5:0.0,format=yuv420p"),
            *ENC, str(vd / f"{e['id']}.mp4")])

        # El poster es el primer frame real del clip, no la foto: así no hay
        # salto cuando el video toma el relevo.
        ff(["-ss", "0", "-i", str(vd / f"{e['id']}.mp4"), "-frames:v", "1",
            "-q:v", "3", str(sd / f"{e['id']}.jpg")])
        base.unlink()

    tmp.rmdir()
    print(f"{len(ESCENAS)} clips y {len(ESCENAS)} posters en {W}x{H}")


if __name__ == "__main__":
    main()
