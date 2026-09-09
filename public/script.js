let player;
let isPlaying = false;
let updateInterval;
let upNextQueue = [];

let searchTimeout;
document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    if(query.length < 2) {
        document.getElementById('search-results').innerHTML = '';
        return;
    }
    searchTimeout = setTimeout(() => { liveSearch(query); }, 400);
});

async function liveSearch(query) {
    const resContainer = document.getElementById('search-results');
    resContainer.innerHTML = '<p class="text-slate-400 text-sm text-center">Searching...</p>';
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        resContainer.innerHTML = '';
        data.items.forEach(item => {
            const safeTitle = item.title.replace(/'/g, "\\'");
            const safeArtist = item.artist.replace(/'/g, "\\'");
            resContainer.innerHTML += `
                <div class="flex items-center gap-3 p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-700 transition" 
                     onclick="initSong('${item.videoId}', '${safeTitle}', '${safeArtist}', '${item.thumbnail}')">
                    <img src="${item.thumbnail}" class="w-14 h-14 rounded-lg object-cover">
                    <div class="overflow-hidden">
                        <p class="text-sm font-bold text-slate-100 truncate">${item.title}</p>
                        <p class="text-xs text-slate-400 truncate">${item.artist}</p>
                    </div>
                </div>`;
        });
    } catch(err) {
        resContainer.innerHTML = '<p class="text-red-400 text-sm text-center">Error fetching results</p>';
    }
}

function initSong(vid, title, artist, thumb) {
    document.getElementById('mini-thumb').src = thumb;
    document.getElementById('main-thumb').src = thumb;
    document.getElementById('mini-title').innerText = title;
    document.getElementById('main-title').innerText = title;
    document.getElementById('mini-artist').innerText = artist;
    document.getElementById('main-artist').innerText = artist;
    document.getElementById('mini-player').classList.remove('hidden');

    if(player && player.loadVideoById) {
        player.loadVideoById(vid);
    } else {
        document.getElementById('yt-container').innerHTML = '<div id="yt-player"></div>';
        player = new YT.Player('yt-player', {
            height: '10', width: '10', videoId: vid,
            playerVars: { 'playsinline': 1, 'controls': 0, 'disablekb': 1, 'rel': 0 },
            events: { 'onReady': e => e.target.playVideo(), 'onStateChange': onStateChange }
        });
    }

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title, artist: artist,
            artwork: [
                { src: thumb, sizes: '96x96', type: 'image/jpeg' },
                { src: thumb, sizes: '256x256', type: 'image/jpeg' },
                { src: thumb, sizes: '512x512', type: 'image/jpeg' }
            ]
        });
        navigator.mediaSession.setActionHandler('play', () => player.playVideo());
        navigator.mediaSession.setActionHandler('pause', () => player.pauseVideo());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNextInQueue());
    }
    fetchUpNext(vid);
}

function onStateChange(e) {
    const silentAudio = document.getElementById('silent-audio');

    if(e.data == YT.PlayerState.PLAYING) {
        isPlaying = true;
        document.getElementById('mini-play-icon').innerText = '⏸';
        document.getElementById('main-play-icon').innerText = '⏸';
        
        // Background play trick
        silentAudio.play().catch(err => console.log("Silent audio blocked:", err));

        const seekBar = document.getElementById('seek-bar');
        seekBar.max = player.getDuration();
        document.getElementById('total-time').innerText = formatTime(player.getDuration());
        
        clearInterval(updateInterval);
        updateInterval = setInterval(() => {
            seekBar.value = player.getCurrentTime();
            document.getElementById('current-time').innerText = formatTime(player.getCurrentTime());
        }, 500);

    } else if(e.data == YT.PlayerState.PAUSED) {
        isPlaying = false;
        document.getElementById('mini-play-icon').innerText = '▶';
        document.getElementById('main-play-icon').innerText = '▶';
        
        // Pause silent audio
        silentAudio.pause();
        clearInterval(updateInterval);

    } else if(e.data == YT.PlayerState.ENDED) {
        playNextInQueue();
    }
}

function formatTime(t) {
    if(isNaN(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
}

function togglePlay() {
    if(!player) return;
    isPlaying ? player.pauseVideo() : player.playVideo();
}

function toggleMainPlayer() {
    const mainPlayer = document.getElementById('main-player');
    mainPlayer.classList.remove('hidden');
    setTimeout(() => mainPlayer.classList.toggle('player-open'), 10);
}

document.getElementById('seek-bar').addEventListener('input', (e) => {
    if(player) {
        player.seekTo(e.target.value, true);
        document.getElementById('current-time').innerText = formatTime(e.target.value);
    }
});

async function fetchUpNext(vid) {
    const listContainer = document.getElementById('up-next-list');
    listContainer.innerHTML = '<p class="text-xs text-slate-500">Loading recommendations...</p>';
    try {
        const res = await fetch(`/api/next?id=${vid}`);
        upNextQueue = await res.json(); 
        listContainer.innerHTML = '';
        for(let i = 1; i < upNextQueue.length; i++) {
            const item = upNextQueue[i];
            const safeTitle = item.title.replace(/'/g, "\\'");
            const safeArtist = item.artist.replace(/'/g, "\\'");
            const thumb = `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`;
            listContainer.innerHTML += `
                <div class="flex items-center gap-3 py-2 cursor-pointer hover:bg-slate-800 rounded-lg px-2"
                     onclick="initSong('${item.videoId}', '${safeTitle}', '${safeArtist}', '${thumb}')">
                    <img src="${thumb}" class="w-12 h-12 rounded object-cover shadow-sm">
                    <div class="overflow-hidden">
                        <p class="text-sm font-semibold text-slate-200 truncate">${item.title}</p>
                        <p class="text-xs text-slate-500 truncate">${item.artist}</p>
                    </div>
                </div>`;
        }
    } catch(e) {
        listContainer.innerHTML = '<p class="text-xs text-red-500">Failed to load Up Next.</p>';
    }
}

function playNextInQueue() {
    if(upNextQueue.length > 1) {
        const nextSong = upNextQueue[1]; 
        const safeTitle = nextSong.title.replace(/'/g, "\\'");
        const safeArtist = nextSong.artist.replace(/'/g, "\\'");
        const thumb = `https://i.ytimg.com/vi/${nextSong.videoId}/hqdefault.jpg`;
        initSong(nextSong.videoId, safeTitle, safeArtist, thumb);
    }
}
