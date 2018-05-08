Set file="%windir%\System32\drivers\etc\hosts"
Set backupfile="%windir%\System32\drivers\etc\hostsnew"
findstr /v "127.0.0.1 goatdemo.azurewebsites.net" %file% > %backupfile%
type %backupfile% > %file%
del /Q %backupfile%