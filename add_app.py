import glob, os
files = glob.glob('C:/Users/User/Desktop/projeto brics/frontend/*.html')
for f in files:
    with open(f,'r',encoding='utf-8',errors='ignore') as file:
        content = file.read()
    if 'app.js' not in content and '</body>' in content:
        content = content.replace('</body>', '<script src="app.js?v=14"></script>\n</body>')
        with open(f,'w',encoding='utf-8',errors='ignore') as file:
            file.write(content)
        print('adicionou app.js em', os.path.basename(f))
