import datetime, requests, os, threading, time, socketserver, webbrowser, json, tempfile, urllib.request, sqlite3, re, random, subprocess
from tempfile import NamedTemporaryFile
from fastapi import FastAPI, HTTPException, Response, Cookie, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from urllib.parse import unquote
from PIL import Image


def CompileWebFiles():
    for file in os.listdir("Web/Html"):
        with open(f"Web/Html/{file}", "r", encoding="utf-8") as f:
            HTML = f.read()
        with open(f"Web/Css/{file.replace(".html", ".css")}", "r", encoding="utf-8") as f:
            CSS = f.read()
        with open(f"Web/Js/{file.replace(".html", ".js")}", "r", encoding="utf-8") as f:
            JS = f.read()
        with open(f"Web/Compilated/{file}", "w", encoding="utf-8") as f:
            f.write(HTML.replace("***style***", CSS).replace("***script***", JS))


def ChunkList(liste: list, taille: int):
    for _ in range(0, len(liste), taille):
        yield liste[_:_ + taille]


def DateSlicer(date: datetime.datetime.date):
    return str(date)[:10]


def ListAPIKeysNumber(value : int = 1, key : str = "NotNone"):
    while True:
        key = os.getenv(f"YoutubeAPIKey{value}")
        if key is None:
            return value - 1
        value += 1


def GetRandomAPIKey(max_number):
    number = random.randint(1, max_number)
    return os.getenv(f"YoutubeAPIKey{number}")


def DateMaker(date: str):
    return f"{date[:4]}-{date[4:6]}-{date[6:8]}"


def TimeToNumber(time):
    return int(time.replace(":", ""))


def TimeConverter(time):
    pattern = r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?'
    match = re.match(pattern, time)
    if not match:
        return "00:00"
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    if hours > 0:
        return f"{hours}:{minutes:02}:{seconds:02}"
    else:
        return f"{minutes:02}:{seconds:02}"


def UCIDtoUUID(UCID):
    return f"UU{UCID[2:]}"


def SearchUCID(name):
    try:
        data = json.loads(requests.get(f"https://www.youtube.com/{name}").text.split("var ytInitialData =")[1].split(";</script>")[0])["contents"]["twoColumnBrowseResultsRenderer"]["tabs"][0]["tabRenderer"]["endpoint"]["browseEndpoint"]
    except:
        data = json.loads(requests.get(f"https://www.youtube.com/c/{name}").text.split("var ytInitialData =")[1].split(";</script>")[0])["contents"]["twoColumnBrowseResultsRenderer"]["tabs"][0]["tabRenderer"]["endpoint"]["browseEndpoint"]
    return data["browseId"], unquote(data["canonicalBaseUrl"][1:])


def AddYoutubeurToJson(name):
    with open("Youtubeurs/youtubeurs.json", "r", encoding="utf-8") as f:
        data = json.loads(f.read())
        youtubeurs = list(data.keys())
        if name in youtubeurs:
            return "Already exists", None
        else:
            UCID, true_name = SearchUCID(name)
        if true_name in youtubeurs:
            return "Already exists", None
        else:
            data[true_name] = UCID
    with NamedTemporaryFile("w", delete=False, dir="Youtubeurs", encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)
        temp_name = file.name
    os.replace(temp_name, f"Youtubeurs/youtubeurs.json")
    if os.path.exists(temp_name):
        os.remove(temp_name)
    return UCID, true_name


def LoadNewYoutubeur(UCID, name):
    result = subprocess.run(["yt-dlp.exe", "--flat-playlist", "--print", "%(id)s", f"https://www.youtube.com/playlist?list={UCIDtoUUID(UCID)}"], capture_output=True, text=True)
    video_ids = result.stdout.strip().split("\n")[::-1]
    all_videos = {"videos": {}, "dates": [], "ids": []}
    API_KEY = GetRandomAPIKey(api_keys_number)
    for group_videos in ChunkList(video_ids, 50):
        ids_str = ",".join(group_videos)
        url = f"https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id={ids_str}&key={API_KEY}"
        response = requests.get(url)
        data = response.json()
        for item in data.get("items", []):
            vid = item["id"]
            title = item["snippet"]["title"]
            date = DateSlicer(item["snippet"]["publishedAt"])
            duration = item["contentDetails"]["duration"]
            all_videos["videos"][vid] = [title, TimeConverter(duration), date]
            if all_videos["dates"] and date == all_videos["dates"][-1]:
                all_videos["ids"][-1].append(vid)
            else:
                all_videos["dates"].append(date)
                all_videos["ids"].append([vid])
    with tempfile.NamedTemporaryFile("w", delete=False, dir="Youtubeurs", encoding="utf-8") as tmp:
        json.dump(all_videos, tmp, indent=2, ensure_ascii=False)
        temp_name = tmp.name
    os.replace(temp_name, f"Youtubeurs/{name}.json")
    if os.path.exists(temp_name):
        os.remove(temp_name)


def SubscribeToChannel(channel_id: str):
    data = {
        "hub.mode": "subscribe",
        "hub.topic": f"https://www.youtube.com/xml/feeds/videos.xml?channel_id={channel_id}",
        "hub.callback": f"https://deborah-clouds-finger-bubble.trycloudflare.com/GetWebsubInfos",
        "hub.verify": "async",
    }
    response = requests.post("https://pubsubhubbub.appspot.com/subscribe", data=data)
    print(response, "ok")
    if response.status_code not in [202, 204]:
        raise Exception(f"Erreur abonnement WebSub: {response.status_code} - {response.text}")
    return True


def AddNewYoutubeur(name):
    UCID, true_name = AddYoutubeurToJson(name)
    if true_name is not None:
        LoadNewYoutubeur(UCID, true_name)
        print(SubscribeToChannel(UCID))


CompileWebFiles()
api_keys_number = ListAPIKeysNumber()
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:16000"], allow_methods=["*"], allow_credentials=True, allow_headers=["*"], )
app.mount("/Web/Images", StaticFiles(directory="Web/Images"), name="Images")


@app.on_event("startup")
async def startup_event():
    SubscribeToChannel("UCMyOj6fhvKFMjxUCp3b_3gA")


@app.get("/GetWebsubInfos")
def CheckYoutubeWebsub(request: Request):
    if request.query_params.get("hub.mode") == "subscribe":
        challenge = request.query_params.get("hub.challenge")
        if not challenge:
            return Response("Missing challenge")
        return Response(challenge)
    else:
        print(request)


@app.get("/", response_class=HTMLResponse)
def BaseFile():
    with open("Web/Compilated/main.html", "r", encoding="utf-8") as BaseFile:
        return BaseFile.read()