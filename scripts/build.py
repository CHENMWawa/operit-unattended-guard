from pathlib import Path
import hashlib,zipfile
root=Path(__file__).resolve().parents[1]
dist=root/'dist';dist.mkdir(exist_ok=True)
archive=dist/'local.operit.unattended_guard.toolpkg'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for name in ['manifest.json','main.js','packages/guard.js','ui/panel.js']:
        z.write(root/name,name)
checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
(dist/'SHA256SUMS').write_text(checksum+'  '+archive.name+'\n')
print(archive)
print(checksum)
