import base64,json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
entries=[('/','index.html','text/html; charset=utf-8'),('/app.css','app.css','text/css'),('/app.js','app.js','application/javascript'),('/mark.png','mark.png','image/png')]
assets={path:[mime,base64.b64encode((root/'ui'/file).read_bytes()).decode()] for path,file,mime in entries}
(root/'dist/server/index.js').write_text((root/'worker/index.js').read_text().replace('__ASSETS__',json.dumps(assets)))
