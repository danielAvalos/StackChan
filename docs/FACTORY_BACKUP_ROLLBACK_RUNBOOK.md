# Respaldo y rollback del StackChan factory 1.6.0

Este runbook protege el firmware y la configuración de fábrica antes de
cualquier prueba de Timothée. No se ejecutó sobre el robot. La versión `1.6.0`
es el dato observado por el propietario; debe registrarse de nuevo justo antes
de una operación física.

## Invariantes

- No se escribe, borra ni actualiza el ESP32 durante el respaldo.
- No se usa la microSD como sustituto del respaldo de la flash interna.
- No se infiere el tamaño de flash desde `sdkconfig`, el modelo comercial o la
  capacidad de la tarjeta. Se obtiene del propio chip.
- El archivo de respaldo se conserva en dos medios independientes y se verifica
  su SHA-256 antes de considerar habilitada cualquier instalación.
- Si `flash-id`, `read-flash ALL` o la verificación fallan, se detiene el
  procedimiento. No se usa `--force`, `erase-flash` ni `write-flash` para
  “corregir” el problema.

## Respaldo de la flash interna (sólo lectura)

Usar una instalación de `esptool` previamente revisada y sustituir `PORT` por
el puerto confirmado en el inventario. No pegar comandos de escritura en esta
fase.

```sh
python -m esptool --chip esp32s3 --port PORT flash-id \
  | tee factory-esptool-flash-id.txt

python -m esptool --chip esp32s3 --port PORT read-flash 0 ALL \
  factory-flash-1.6.0.bin

shasum -a 256 factory-flash-1.6.0.bin \
  | tee factory-flash-1.6.0.sha256
```

Conservar junto al binario:

- fecha/hora y zona horaria;
- número de serie, MAC y puerto utilizado;
- salida completa de `flash-id`;
- versión visible del firmware (`1.6.0`, si continúa siendo la observada);
- versión exacta de `esptool` y sistema operativo;
- tamaño reportado por el chip y tamaño real del archivo.

Después, copiar el conjunto a dos destinos independientes, por ejemplo un
disco externo y un repositorio de evidencias fuera del checkout. No publicar
el dump: puede contener NVS, identidad, pairing o datos privados.

## Respaldo de la microSD de 16 GB

La tarjeta se trata como almacenamiento auxiliar, no como firmware arrancable.
Primero identificarla por capacidad y fabricante con `diskutil list`; no usar
un identificador elegido por posición. Sólo después de confirmar el disco
correcto se desmonta ese disco y se hace una imagen de lectura con una ruta
explícita, por ejemplo:

```sh
diskutil list
diskutil unmountDisk /dev/diskN
sudo dd if=/dev/rdiskN of=stackchan-microsd-16gb.img bs=4m status=progress
shasum -a 256 stackchan-microsd-16gb.img \
  | tee stackchan-microsd-16gb.sha256
```

`diskN` es un marcador deliberado: no debe sustituirse sin volver a comprobar
la salida de `diskutil list`. Nunca invertir `if` y `of`; hacerlo escribiría en
la tarjeta o en otro disco.

## Restauración y criterios de desbloqueo

La ruta primaria de restauración es M5Burner, buscando StackChan con “Only
Official” habilitado. La guía oficial de M5Stack documenta esa ruta para
recuperar el firmware factory. Un dump leído con `esptool` es evidencia y
respaldo de recuperación, pero no autoriza por sí solo una escritura: Secure
Boot, Flash Encryption, tamaño real, offsets, particiones OTA y NVS deben estar
identificados para el hardware concreto.

Antes de cualquier flash físico deben existir todos estos artefactos:

1. dump completo de flash y hash verificado;
2. copia independiente recuperable;
3. imagen de la microSD y hash, si la tarjeta contiene datos que se desean
   conservar;
4. versión factory y estado de pairing documentados;
5. paquete/imagen nueva con origen, hash y compatibilidad verificados;
6. procedimiento de retorno probado en un equipo de laboratorio o una ruta
   oficial equivalente;
7. aprobación explícita del propietario para la operación física.

Hasta entonces, el fork sólo admite builds, pruebas host, XSA y simulación. El
MOD de Timothée permanece desacoplado del arranque factory y la microSD no se
usa como mecanismo de boot.

## Referencias

- [Guía oficial StackChan: Restore Factory Firmware](https://docs.m5stack.com/en/StackChan)
- [esptool: read flash contents y flash ID](https://docs.espressif.com/projects/esptool/en/latest/esp32s3/esptool/basic-commands.html)
- [esptool: límites de Secure Download Mode](https://docs.espressif.com/projects/esptool/en/latest/esp32/troubleshooting.html)
