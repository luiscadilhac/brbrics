import os, glob
files = glob.glob('C:/Users/User/Desktop/projeto brics/frontend/*.html')
print('total html:', len(files))
for f in files:
    with open(f,'r',encoding='utf-8',errors='ignore') as file:
        content = file.read()
    if '<div class="ticker">' in content:
        print('tem ticker:', os.path.basename(f))
    else:
        print('SEM ticker:', os.path.basename(f))
