# Respaldo y rollback del StackChan factory (baseline verificado)

Este runbook protege el firmware y la configuración de fábrica antes de
cualquier prueba de Timothée. La preservación read-only del 2026-11-02
identificó en el dump protegido un `ota_1` `stack-chan` `1.6.0` seleccionado y
un `ota_0` `1.5.1` válido como rollback alterno. El dump tiene SHA-256
`a949829dd25887a12919858c5784741995e5c5bf87bddee72109bead70a63d59` y el
manifiesto local fue validado con `status=pass`. Esto sigue siendo evidencia
estructural: no se ha ensayado una restauración física y no existe una imagen
RAW de la microSD.

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
  factory-flash-<version-leida>.bin

shasum -a 256 factory-flash-<version-leida>.bin \
  | tee factory-flash-<version-leida>.sha256
```

Conservar junto al binario:

- fecha/hora y zona horaria;
- número de serie, MAC y puerto utilizado;
- salida completa de `flash-id`;
- versión visible del firmware (`<version-leida>`; hoy sólo existe el reporte
  del propietario, no una relectura independiente);
- versión exacta de `esptool` y sistema operativo;
- tamaño reportado por el chip y tamaño real del archivo.

Después, copiar el conjunto a dos destinos independientes, por ejemplo un
disco externo y un repositorio de evidencias fuera del checkout. No publicar
el dump: puede contener NVS, identidad, pairing o datos privados.

Cuando el conjunto esté reunido, crear un `manifest.json` con el esquema
`stackchan-factory-preservation` y verificarlo sin tocar el dispositivo:

```sh
node tools/verify_factory_backup.mjs /ruta/al/respaldo
```

La herramienta exige artefactos `factory-flash`, `microSD-image`,
`esptool-report` y `rollback-proof`. El último debe ser JSON con
`kind=stackchan-rollback-proof`, `status=verified`,
`evidenceType=structural-attestation`, la versión factory y el SHA-256 exacto
del dump `factory-flash`; así el manifiesto no puede pasar por alto la
existencia de una atestación de retorno. El resultado del validador es sólo
`manifest-structure-only`: no demuestra criptográficamente que se haya
ejecutado una restauración física. La herramienta comprueba tamaño y SHA-256
mediante streaming, y rechaza traversal, symlinks fuera del directorio,
duplicados y archivos faltantes. No ejecuta `esptool`, no abre puertos serie y
no contiene comandos de escritura.

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
