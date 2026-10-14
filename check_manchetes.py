with open('C:/Users/User/Desktop/projeto brics/frontend/manchetes.html','r',encoding='utf-8',errors='ignore') as f:
    content = f.read()
print('header?', '<header' in content)
print('ticker?', '<div class="ticker">' in content)
