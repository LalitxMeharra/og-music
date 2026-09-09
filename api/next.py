from http.server import BaseHTTPRequestHandler
import requests
import json
from urllib.parse import urlparse, parse_qs

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query_components = parse_qs(urlparse(self.path).query)
        video_id = query_components.get('id', [''])[0]

        if not video_id:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "No video ID provided"}).encode('utf-8'))
            return

        url = 'https://music.youtube.com/youtubei/v1/next?prettyPrint=false'
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
            'X-YouTube-Client-Name': '67',
            'X-YouTube-Client-Version': '6.42.52'
        }
        payload = {
            "context": {
                "client": {
                    "clientName": "ANDROID_MUSIC",
                    "clientVersion": "6.42.52"
                }
            },
            "videoId": video_id,
            "playlistId": f"RDAMVM{video_id}",
            "isAudioOnly": True
        }

        try:
            response = requests.post(url, headers=headers, json=payload)
            yt_data = response.json()
            recommended_songs = []

            tabs = yt_data.get('contents', {}).get('singleColumnMusicWatchNextResultsRenderer', {}).get('tabbedRenderer', {}).get('watchNextTabbedResultsRenderer', {}).get('tabs', [])
            
            queue_contents = []
            for tab in tabs:
                if 'tabRenderer' in tab and 'content' in tab['tabRenderer']:
                    content = tab['tabRenderer']['content']
                    if 'musicQueueRenderer' in content:
                        queue_contents = content['musicQueueRenderer']['content']['playlistPanelRenderer']['contents']
                        break

            for item in queue_contents:
                if 'playlistPanelVideoRenderer' in item:
                    video_data = item['playlistPanelVideoRenderer']
                    v_id = video_data.get('videoId')
                    title = video_data.get('title', {}).get('runs', [{}])[0].get('text', 'Unknown Title')
                    
                    artist = "Unknown Artist"
                    if 'longBylineText' in video_data:
                        artist = video_data['longBylineText']['runs'][0]['text']
                    
                    if v_id:
                        recommended_songs.append({
                            "title": title,
                            "artist": artist,
                            "videoId": v_id
                        })

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(recommended_songs).encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
