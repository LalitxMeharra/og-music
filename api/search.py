from http.server import BaseHTTPRequestHandler
import requests
import json
from urllib.parse import urlparse, parse_qs

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Frontend se search query (e.g., ?q=Sitaare) extract karna
        query_components = parse_qs(urlparse(self.path).query)
        search_query = query_components.get('q', [''])[0]

        if not search_query:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "No query provided"}).encode('utf-8'))
            return

        # Original YouTube Music API Logic
        url = 'https://music.youtube.com/youtubei/v1/search?prettyPrint=false'
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
            'X-YouTube-Client-Name': '67',
            'X-YouTube-Client-Version': '6.42.52'
        }
        payload = {
            "query": search_query,
            "context": {
                "client": {
                    "clientName": "ANDROID_MUSIC",
                    "clientVersion": "6.42.52"
                }
            }
        }

        try:
            response = requests.post(url, headers=headers, json=payload)
            yt_data = response.json()

            # Data parsing logic based on your raw JSON structure
            # Hum yahan sirf zaroori data nikalenge taaki frontend fast load ho
            parsed_results = []
            
            try:
                # Navigating the complex YT JSON tree (Based on your search_response.json)
                contents = yt_data['contents']['tabbedSearchResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'][0]['itemSectionRenderer']['contents']
                
                for item in contents:
                    if 'elementRenderer' in item:
                        try:
                            music_data = item['elementRenderer']['newElement']['type']['componentType']['model']['musicTopResultCardShelfModel']['shelfData']['musicTopResultCardHeaderData']
                            
                            title = music_data['title']
                            subtitle = music_data['subtitle']
                            video_id = music_data['nowPlayingItem']['videoId']
                            thumb_url = music_data['thumbnail']['image']['sources'][0]['url']
                            
                            parsed_results.append({
                                "title": title,
                                "artist": subtitle,
                                "videoId": video_id,
                                "thumbnail": thumb_url
                            })
                        except KeyError:
                            continue # Agar ye specific card format nahi hai toh skip
            except Exception as e:
                print(f"Parsing Error: {e}")

            # Send parsed response to frontend
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"items": parsed_results}).encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
