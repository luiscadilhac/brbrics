with open('C:/Users/User/Desktop/projeto brics/frontend/index.html','r',encoding='utf-8',errors='ignore') as f:
    content = f.read()
start = content.find('id="mercado-cripto"')
print(content[start-50:start+250])
