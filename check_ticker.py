with open('C:/Users/User/Desktop/projeto brics/frontend/index.html','r',encoding='utf-8',errors='ignore') as f:
    content = f.read()
start = content.find('<div class="ticker">')
if start>0:
    print('index ticker starts at', start)
    print(content[start:start+400])
else:
    print('not found in index')
