const todayStr = new Date().toISOString().split('T')[0], CHUNK_SIZE = 4 * 8;
['date_1', 'date_21', 'date_22'].forEach(id => { const el = document.getElementById(id); if(el) { el.value = todayStr; el.max = todayStr;}});
let allData = [], currentIndex = 0, isNextBatchLoading = false;

function updateResultsCount(count) {
    let header = document.getElementById('results-header');
    if (!header) {
        header = document.createElement('div');
        header.id = 'results-header';
        header.className = 'results-header';
        const scroller = document.getElementById('video-scroller');
        scroller.insertBefore(header, scroller.firstChild);
    }
    header.innerHTML = `Résultats : <span>${count}</span> vidéo${count > 1 ? 's' : ''}`;
}

function updateScroller(data) {
    const scroller = document.getElementById('video-scroller');
    allData = data;
    currentIndex = 0;
    scroller.innerHTML = '';
    updateResultsCount(allData.length);
    renderNextVideos(true);
    const sentinel = document.createElement('div');
    sentinel.id = 'sentinel';
    sentinel.style.height = '10px';
    scroller.appendChild(sentinel);
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isNextBatchLoading && currentIndex < allData.length) {
            renderNextVideos(false);
        }
    }, {
        root: scroller,
        rootMargin: '200px'
    });
    observer.observe(sentinel);
}

function executeInjection() {
    const template = document.getElementById('card-template'), scroller = document.getElementById('video-scroller'), sentinel = document.getElementById('sentinel'), mainFragment = document.createDocumentFragment(), nextBatch = allData.slice(currentIndex, currentIndex + CHUNK_SIZE);
    for (let i = 0; i < nextBatch.length; i += 4) {
        const wrapper = document.createElement('div');
        wrapper.className = 'wrapper';
        const chunk = nextBatch.slice(i, i + 4);
        chunk.forEach(video => {
            const clone = template.content.cloneNode(true), thumbnail = clone.querySelector('.thumbnail'), laterIcon = clone.querySelector('.later-icon'), downloadIcon = clone.querySelector('.download-icon');
            laterIcon.onclick = (e) => {
                e.stopPropagation();
                communication({url: video.id, title: video.title, time: video.duration}, 'WatchLater');
            };
            if (video.download === true) {
                downloadIcon.onclick = (e) => {
                    e.stopPropagation();
                    communication({url: video.id}, 'DeleteVideoFile');
                };
            } else {
                downloadIcon.onclick = (e) => {
                    e.stopPropagation();
                    communication({url: video.id, title: video.title, duration: video.duration}, 'DownloadVideo');
                };
            }
            thumbnail.src = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
            thumbnail.loading = "lazy";
            thumbnail.onclick = () => {
                communication({url: video.id, title: video.title, download: video.download}, 'Open');
            };
            clone.querySelector('.text').textContent = video.title;
            clone.querySelector('.duration').textContent = video.duration;
            clone.querySelector('.category').textContent = 'Vidéo';
            wrapper.appendChild(clone);
        });
        mainFragment.appendChild(wrapper);
    }
    currentIndex += CHUNK_SIZE;
    if (sentinel) {
        scroller.insertBefore(mainFragment, sentinel);
    } else {
        scroller.appendChild(mainFragment);
    }
}

function renderNextVideos(isInitial = false) {
    if (isNextBatchLoading) return;
    if (!isInitial) {
        isNextBatchLoading = true;
        setTimeout(() => {
            executeInjection();
            isNextBatchLoading = false;
        }, 50);
    } else {
        executeInjection();
    }
}

function communication(dict, where) {
    return fetch(`https://app.astrovoice.ch/my-youtube/${where}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dict)
    });
}

async function chargerYoutubeurs() {
    const youtubeurs = await communication({}, 'GetYoutubeurs');
    const grid = document.querySelector('.grid-checkbox');
    grid.innerHTML = youtubeurs.map(y => `<label><input type="checkbox" name="creator" value="${y}"> ${y}</label>`).join('\n');
}

async function sendSearch() {
    const scroller = document.getElementById('video-scroller');
    const loader = document.getElementById('loading-container');
    loader.style.display = 'block';
    scroller.style.opacity = '0.4';
    const selectedCreators = Array.from(document.querySelectorAll('input[name="creator"]:checked')).map(cb => cb.value);
    const payload = {
        filter: document.getElementById('liste_deroulante').value,
        title: document.getElementById('titleSearch').value,
        duration: {
            min: document.getElementById('durationMin').value,
            max: document.getElementById('durationMax').value
        },
        creators: selectedCreators,
        dates: {
            single: document.getElementById('date_1').value,
            start: document.getElementById('date_21').value,
            end: document.getElementById('date_22').value
        }
    };
    try {
        const response = await communication({email: "mathias.trz@eduge.ch", password: "mypassword"}, 'CreateUser');
        await new Promise(resolve => setTimeout(resolve, 300));
        if (response.ok) {
            const results = await response.json();
            updateScroller(results);
        }
    } catch (error) {
        console.error("Erreur serveur :", error);
    } finally {
        loader.style.display = 'none';
        scroller.style.opacity = '1';
    }
}

function toggleSearchBar() {
    const mode = document.getElementById('liste_deroulante').value, container = document.getElementById('date_inputs'), d1 = document.getElementById('date_1'), d21 = document.getElementById('date_21'), d22 = document.getElementById('date_22');
    container.style.display = (mode === 'single' || mode === 'range') ? 'inline-flex' : 'none';
    d1.style.display = (mode === 'single') ? 'block' : 'none';
    d21.style.display = (mode === 'range') ? 'block' : 'none';
    d22.style.display = (mode === 'range') ? 'block' : 'none';
}

function toggleMaxDuration() {
    const minVal = document.getElementById('durationMin').value;
    document.getElementById('durationMax').style.display = minVal ? 'inline-block' : 'none';
}

function toggleDropdown(event) {
    event.stopPropagation();
    document.getElementById('dropdown').classList.toggle('open');
}

document.getElementById('dropdownContent').addEventListener('click', e => e.stopPropagation());
document.addEventListener('click', () => document.getElementById('dropdown').classList.remove('open'));

sendSearch();
chargerYoutubeurs();