# Timothee sobre StackChan factory 1.6.0

## Alcance

Esta rama parte del firmware oficial `m5stack/StackChan` y conserva su ruta
de arranque, audio, OTA, almacenamiento interno, aplicaciones y servidor
`/stackChan/ws`. La extensión de Timothee comienza con un contrato semántico
pequeño y testeable; no reemplaza el firmware de fábrica ni abre una segunda
plataforma de audio.

El contrato vive en:

- `firmware/main/stackchan/timothee/timothee_expression.h`
- `firmware/main/stackchan/timothee/timothee_expression.cpp`
- `firmware/main/stackchan/timothee/timothee_expression_bridge.h`
- `firmware/main/stackchan/timothee/timothee_expression_bridge.cpp`

Es deliberadamente independiente de proveedores, Sky, Genesis y transporte.
Un mensaje remoto solo podrá convertirse en una expresión después de pasar
por este vocabulario cerrado. Valores desconocidos se rechazan y no hay
ejecución de comandos, shell, credenciales ni acciones de Genesis en el
dispositivo.

## Correspondencia con el MOD actual

El MOD de Timothee define siete estados semánticos y perfiles de LED. El
adaptador C++ conserva esos estados y los traduce a las emociones que ya
existen en StackChan (`Neutral`, `Happy`, `Doubt`, `Sleepy`). Los porcentajes
de brillo y las duraciones quedan acotados en tipos enteros.

La aplicación de la expresión al avatar todavía no se engancha al ciclo de
arranque: eso es intencional. `ExpressionBridge` es el consumidor explícito,
pero nace desactivado (`BridgePolicy.enabled=false`) y solo puede ser invocado
por un punto de integración futuro que el dueño habilite. Cuando se habilita,
valida el vocabulario cerrado, limita la duración y usa el modificador timed
existente para restaurar la emoción anterior; no procesa JSON, red, WSS,
credenciales, OTA ni comandos. Así el comportamiento factory 1.6.0 no cambia
por compilar la extensión.

## Red y seguridad

El firmware factory ya tiene dos rutas propias que no deben confundirse:

1. XiaoZhi para audio/voz.
2. `/stackChan/ws` para el relay de avatar, controles y aplicaciones.

La futura conexión WSS de Sky se implementará como un adaptador de transporte
separado y autenticado, reutilizando el stack TLS existente. No se añadirá
reconexión infinita, credenciales embebidas ni endpoint Genesis en la ruta de
renderizado. Genesis recibirá artefactos normalizados desde Sky; el dispositivo
no tendrá autoridad para ejecutar misiones ni acceso a secretos de proveedor.

## MicroSD de 16 GB

El esquema de particiones oficial 1.6.0 reserva NVS, dos ranuras OTA, assets
SPIFFS y coredump; no define una partición SD ni un arranque desde SD. Por eso
la tarjeta se reserva inicialmente para respaldos, paquetes firmados, logs o
cola offline cuando exista un módulo explícito y con límites. No se usará como
dependencia de boot ni como mecanismo de recuperación hasta contar con una
prueba de rollback verificable.

## Flujo de actualización

El respaldo físico previo está definido en
[`FACTORY_BACKUP_ROLLBACK_RUNBOOK.md`](FACTORY_BACKUP_ROLLBACK_RUNBOOK.md). Es
un gate previo, no un paso automático: hasta tener dump/hash/copia
independiente y una ruta de restauración revisada, no se ejecutan comandos de
escritura sobre el CoreS3.

El clon original permanece como referencia local. Esta copia de trabajo tiene
la rama `codex/timothee-factory-1.6.0`, el remoto `origin` apuntando por SSH al
fork personal `ssh://git@ssh.github.com:443/danielAvalos/StackChan.git` y el remoto
`upstream` apuntando a `https://github.com/m5stack/StackChan.git`. El fork
remoto ya fue creado. La rama se publicó después de revisar la sincronización
y confirmar la autenticación Git para GitHub; no se publicó ningún cambio en
`upstream`.

Auditoría local del 2026-11-02: `git fetch --prune --tags upstream main` dejó
`upstream/main` en `f901cc2` (`chore: sync wecom-digest-forward workflow`). La
rama `codex/timothee-factory-1.6.0` está `0` commits detrás y `5` commits
propios delante de ese punto; no se requiere merge de upstream. `git diff
--check upstream/main...HEAD` pasa. La prueba host `timothee_expression_test`
se compiló con Apple Clang/C++17 y pasó; ahora cubre también la política
fail-closed del bridge (`disabled`, vocabulario cerrado, avatar ausente y
duración inválida). En un clon temporal aislado del commit publicado
`8babfb0`, ESP-IDF `v5.5.4` completó el build ESP32-S3 `2498/2498`, con
`stack-chan.bin` de 3,739,552 bytes y SHA-256
`b37604699476c1dcbb21c528cd7cbe02d035c7c6be6a7a3ef73004ef3baef862`;
`esptool image_info` validó su checksum y validation hash offline. El build
no abrió el puerto USB y no ejecutó flash, erase, OTA, NVS ni deploy. El
workflow mantiene CMake/CTest y ahora también el build ESP-IDF como gates
autoritativos en CI. La primera publicación SSH de la rama al fork `danielAvalos/StackChan`
dejó el remoto en `1d90410`; las actualizaciones posteriores mantuvieron la
rama sincronizada. La URL local usa `ssh.github.com:443` para evitar el
cierre de `github.com:443`. Después, el workflow remoto
`Sync StackChan upstream` ejecutó checkout, fetch, CMake, build y CTest para
`03ccee7f14b8ef5c34e8c1569fc58320e2828078` y terminó `success` en el run
[`41324206470`](https://github.com/danielAvalos/StackChan/actions/runs/41324206470);
la publicación de una rama de revisión fue correctamente omitida porque
upstream ya estaba contenido.

La extensión de política host-testable quedó publicada en el fork como
`04e34a5` (`test(timothee): cover expression bridge policy gate`). El cambio
no instancia el bridge desde el arranque, no agrega red/OTA/NVS y no modifica
el firmware instalado; solo separa la decisión pura para poder probarla sin
descargar el árbol ESP-IDF.

Antes de integrar cambios de upstream:

```sh
git fetch upstream --tags
git log --oneline --decorate --max-count=12 upstream/main
git diff --check upstream/main...HEAD
```

Luego se actualiza una rama de sincronización, se ejecutan las pruebas host,
se construye el firmware y solo después se prueba en hardware. Nunca se
actualiza directamente el dispositivo como parte de un merge.

El workflow `.github/workflows/upstream-sync.yml` automatiza esta disciplina
cada lunes o bajo `workflow_dispatch`: parte de esta rama, trae `upstream/main`,
detiene el proceso ante conflictos, ejecuta `git diff --check` y las pruebas
CMake host, ejecuta un build ESP32-S3 dentro de `espressif/idf:v5.5.4`, y
publica una rama `automation/upstream-sync-*` para revisión. No hace merge
automático, no publica secretos y no ejecuta ningún comando de
flash/deploy/monitor sobre hardware. La descarga de dependencias y la
compilación son pasos separados; el contenedor de compilación usa
`--network none`, elimina capacidades Linux y recibe solo el checkout del
workflow, sin credenciales de producción.

## Puertas antes de WSS físico

1. Contrato semántico host y firmware con pruebas.
2. Adaptador de estado con watchdog, timeouts y restauración segura.
3. Transporte TLS con CA verificable, identidad por dispositivo y límites de
   tamaño/frecuencia.
4. Rechazo explícito de mensajes no autenticados o fuera de esquema.
5. Prueba de desconexión, OTA, factory reset y rollback.
6. Backup de la configuración factory antes de cualquier flash físico.
