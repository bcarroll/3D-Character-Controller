from time import sleep
import webbrowser
import http.server
import socketserver
import threading

address = '127.0.0.1'
port    = 8888

def run():
    Handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer((address, port), Handler) as httpd:
        httpd.serve_forever()

print('Starting Web Server at http://%s:%d' % (address,port))
t = threading.Thread(target=run)
t.start()
sleep(3)
print('Opening Web Browser...')
webbrowser.open('http://%s:%d/index.html' % (address,port))
t.join()