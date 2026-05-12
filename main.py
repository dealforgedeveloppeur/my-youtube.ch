import datetime, requests, os, threading, time, socketserver, webbrowser, json, tempfile, bisect, urllib.request, re, random, subprocess, smtplib
from email.message import EmailMessage
from tempfile import NamedTemporaryFile
from fastapi import FastAPI, HTTPException, Response, Cookie, Depends, status, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from urllib.parse import unquote
from jose import jwt, JWTError
from passlib.context import CryptContext
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from itertools import chain
from functools import partial


def CompileWebFiles():
    for file in os.listdir("Web/Html"):
        with open(f"Web/Html/{file}", "r", encoding="utf-8") as f:
            HTML = f.read()
            HTML = re.sub(r'>\s+<', '><', HTML)
        with open(f"Web/Css/{file.replace(".html", ".css")}", "r", encoding="utf-8") as f:
            CSS = f.read()
            CSS = re.sub(r'\s+', ' ', CSS)
        with open(f"Web/Js/{file.replace(".html", ".js")}", "r", encoding="utf-8") as f:
            JS = f.read()
            JS = re.sub(r'\s+', ' ', JS)
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
        "hub.callback": f"https://app.astrovoice.ch/my-youtube/GetWebsubInfos",
        "hub.verify": "async",
    }
    response = requests.post("https://pubsubhubbub.appspot.com/subscribe", data=data)
    if response.status_code not in [202, 204]:
        raise Exception(f"Erreur abonnement WebSub: {response.status_code} - {response.text}")
    return True


def AddNewYoutubeur(username, name):
    UCID, true_name = AddYoutubeurToJson(name)
    if true_name is not None:
        LoadNewYoutubeur(UCID, true_name)
        print(SubscribeToChannel(UCID))
    with open(f"Users/{username}.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        data["youtubeurs"].append(true_name)
    with NamedTemporaryFile("w", delete=False, dir="Users", encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)
        temp_name = file.name
    os.replace(temp_name, f"Users/{username}.json")
    if os.path.exists(temp_name):
        os.remove(temp_name)


def GetVideoFor(name, start_date: datetime.datetime.now, end_date: datetime.datetime.now, min_length: str, max_length: str, title_words: list):
    with open(f"Youtubeurs/{name}.json", "r", encoding="utf-8") as f:
        all_videos = json.load(f)
        start = bisect.bisect_left(all_videos["dates"], start_date)
        end = bisect.bisect_right(all_videos["dates"], end_date)
        result = list(chain.from_iterable(all_videos["ids"][start:end]))
        videos = []
        for video in result:
            if not min_length or TimeToNumber(min_length) <= TimeToNumber(all_videos["videos"][video][1]) <= TimeToNumber(max_length):
                if not title_words:
                    videos.append({"id": video, "title": all_videos["videos"][video][0], "duration": all_videos["videos"][video][1], "download": False})
                for word in title_words:
                    if len(all_videos["videos"][video][0].lower().split(word)) > 1:
                        videos.append({"id": video, "title": all_videos["videos"][video][0], "duration": all_videos["videos"][video][1], "download": False})
                        break
    return videos


def GetVideos(username, names: list, start_date: datetime.datetime.now, end_date: datetime.datetime.now = None, min_length: str = None, max_length: str = None, title: str = None):
    bans_words = []
    videos = []
    if not names or names == []:
        with open(f"Users/{username}.json", "r", encoding="utf-8") as f:
            names = json.load(f)["youtubeurs"]
    if not end_date or end_date == "":
        end_date = start_date
    if min_length and (not max_length or max_length == ""):
        max_length = min_length
    elif (not min_length and not max_length) or (min_length == "" and max_length == ""):
        min_length, max_length = "00:01", "9:59:59"
    if title == "":
        title = None
    for name in names:
        videos.extend(GetVideoFor(name, start_date, end_date, min_length, max_length, [word.lower() for word in title.split() if word.lower() not in bans_words] if title else []))
    return videos


email_keys = {}
algorithm = "HS256"
access_token_expire_days = 31
sender_email = os.getenv("SENDER_EMAIL")
sender_password = os.getenv("SENDER_PASSWORD")
secret_key = os.getenv("SECRET_KEY")
no_rainbow_tables = os.getenv("PEPPER")
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
api_keys_number = ListAPIKeysNumber()
app = FastAPI()


# @app.on_event("startup")
# async def startup_event():
#    CompileWebFiles()


def CreateToken(data: dict):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.datetime.utcnow() + datetime.timedelta(days=access_token_expire_days)})
    return jwt.encode(to_encode, secret_key, algorithm=algorithm)


async def CheckConnection(request: Request, session_token=None):
    auth_header = str(request.headers.get("Authorization"))
    session_token = auth_header[7:]
    print(session_token)
    payload = jwt.decode(session_token, secret_key, algorithms=[algorithm])
    username: str = payload.get("sub")
    print(username)
    if username is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur invalide.")
    if os.path.exists(f"Users/{username}.json"):
        with open(f"Users/{username}.json", "r", encoding="utf-8") as f:
            if True:#json.load(f)["paiement"] < DateSlicer(datetime.datetime.now()):
                raise HTTPException(status_code=401, detail="Paiement requis.")
    return username


@app.post("/CheckEmail")
def CheckEmail(content: dict, response: Response):
    global email_keys
    email, code, password, username = content.get("email"), content.get("code"), content.get("password"), content.get("username")
    if int(code) == email_keys[email]:
        with open(f"Users/{email}.json", "w", encoding="utf-8") as f:
            datas = {"password": pwd_context.hash(no_rainbow_tables + password), "email": email, "username": username, "youtubeurs": [], "watch_later": [], "downloaded": []}
            json.dump(datas, f, indent=2, ensure_ascii=False)
            return {"success": True, "token": CreateToken(data={"sub": email})}


@app.post("/SendEmail")
def SendEmail(content: dict, response: Response):
    global email_keys
    email, number = content.get("email"), random.randint(100000, 999999)
    email_keys[email] = number
    with open("Web/Compilated/email.html", "r", encoding="utf-8") as f:
        msg = EmailMessage()
        msg["Subject"], msg["From"], msg["To"] = "Votre code de connexion à my-youtube.", sender_email, email
        msg.set_content(f.read().replace("***CODE***", str(number)), subtype="html")
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(sender_email, sender_password)
            smtp.send_message(msg)
    except Exception as e:
        print(f"Une erreur est survenue lors de l'envoi : {e}")


@app.post("/Login")
def Login(content: dict, response: Response):
    email = content.get("email")
    try:
        with open(f"Users/{email}.json", "r", encoding="utf-8") as f:
            user_data = json.load(f)
            if pwd_context.verify(no_rainbow_tables + content.get("password"), user_data["password"]):
                return {"success": True, "token": CreateToken(data={"sub": email})}
    except FileNotFoundError:
        pass
    raise HTTPException(status_code=401, detail="Identifiants incorrects.")


@app.post("/Logout")
def Logout(response: Response):
    return {"message": "Déconnecté."}


@app.post("/Youtube")
def SearchYoutube(content: dict, username: str = Depends(CheckConnection)):
    filter, title, duration = content.get("filter"), content.get("title"), content.get("duration")
    max_length, min_length = duration.get("max"), duration.get("min")
    youtubeurs, dates = content.get("creators"), content.get("dates")
    single_date, range_start_date, range_end_date = dates.get("single"), dates.get("start"), dates.get("end")
    list_of_filters = {
        "today": (datetime.datetime.now, datetime.datetime.now),
        "yesterday": (lambda: datetime.datetime.now() - datetime.timedelta(days=1), lambda: datetime.datetime.now() - datetime.timedelta(days=1)),
        "week": (datetime.datetime.now, lambda: datetime.datetime.now() - datetime.timedelta(weeks=1)),
        "month": (datetime.datetime.now, lambda: datetime.datetime.now() - datetime.timedelta(days=30)),
        "year": (datetime.datetime.now, lambda: datetime.datetime.now() - datetime.timedelta(days=365)),
        "all": (datetime.datetime.now, "2005-01-01"),
        "single" : (single_date, single_date),
        "range": (range_start_date, range_end_date)
    }
    try:
        end_date, start_date = list_of_filters[filter]
    except:
        if filter == "watchlater":
            with open(f"Users/{username}.json", "r", encoding="utf-8") as f:
                videos = json.load(f)["watch_later"]
                values = [{**value, "download": False} for value in values]
            return values
        else:
            with open(f"Users/{username}.json", "r", encoding="utf-8") as f:
                videos = json.load(f)["downloaded"]
                values = [{**value, "download": True} for value in values]
            return values
    start_date = DateSlicer(start_date()) if callable(start_date) else start_date
    end_date = DateSlicer(end_date()) if callable(end_date) else end_date
    videos = GetVideos(username=username, names=youtubeurs, start_date=start_date, end_date=end_date, min_length=min_length, max_length=max_length, title=title)
    return videos


@app.post("/Search")
def SearchOnYoutube(content: dict, username: str = Depends(CheckConnection)):
    query = content.get("query")
    if len(query.split("watch?v=")) < 1:
        """"""
    else:
        AddNewYoutubeur(query)
    

@app.post("/GetYoutubeurs")
def SendYoutubeurs(username: str = Depends(CheckConnection)):
    with open(f"Users/{username}.json", "r", encoding="utf-8") as f:
        youtubeurs = json.load(f)["youtubeurs"]
        return youtubeurs


@app.get("/", response_class=HTMLResponse)
def BaseFile():
    with open("Web/Compilated/main.html", "r", encoding="utf-8") as BaseFile:
        return BaseFile.read()


@app.get("/login", response_class=HTMLResponse)
def LoginPage():
    with open("Web/Compilated/login.html", "r", encoding="utf-8") as BaseFile:
        return BaseFile.read()


@app.get("/paiement", response_class=HTMLResponse)
def Paiement():
    with open("Web/Compilated/paiement.html", "r", encoding="utf-8") as BaseFile:
        return BaseFile.read()


@app.get("/dashboard", response_class=HTMLResponse)
def Dashboard():
    with open("Web/Compilated/dashboard.html", "r", encoding="utf-8") as BaseFile:
        return BaseFile.read()


@app.get("/GetWebsubInfos")
def CheckYoutubeWebsub(request: Request):
    if request.query_params.get("hub.mode") == "subscribe":
        challenge = request.query_params.get("hub.challenge")
        if not challenge:
            return Response("Missing challenge")
        return Response(challenge)
    else:
        print(request)