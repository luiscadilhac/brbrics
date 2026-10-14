with open('C:/Users/User/Desktop/projeto brics/frontend/manchetes.html','r',encoding='utf-8',errors='ignore') as f:
    c=f.read()
start=c.find('id="ticker-in"')
print('manchetes:', c[start:start+200])
with open('C:/Users/User/Desktop/projeto brics/frontend/index.html','r',encoding='utf-8',errors='ignore') as f:
    c=f.read()
start=c.find('id="ticker-in"')
print('index:', c[start:start+200])
