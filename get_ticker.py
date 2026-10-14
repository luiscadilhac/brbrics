with open('C:/Users/User/Desktop/projeto brics/frontend/index.html','r',encoding='utf-8',errors='ignore') as f:
    content = f.read()
start = content.find('<div class="ticker">')
end = content.find('</header>', start)
print(content[start:end])
