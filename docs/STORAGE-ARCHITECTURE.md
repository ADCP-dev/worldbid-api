# Storage & Files Architecture

Este documento detalla la arquitectura de gestión de archivos en el backend, incluyendo la subida (Local/S3) y el sistema de limpieza automática (Garbage Collection) utilizando relaciones polimórficas y TypeORM Subscribers.

## Estructura de Subida (Uploaders)
El módulo `FilesModule` carga dinámicamente un driver específico (`FilesLocalModule` o `FilesS3Module`) en base a la configuración `FILE_DRIVER` del entorno.

Ambos drivers implementan una interfaz común a través del token `'FILE_UPLOADER_SERVICE'`, garantizando que la aplicación solo interactúa con un contrato y abstrae dónde se guardan físicamente los recursos.

- **Local (`FilesLocalService`)**: Guarda los archivos en la carpeta `/files/public` o `/files/private` del disco del servidor y expone los públicos a través del API.
- **S3 (`FilesS3Service`)**: Guarda los archivos en un bucket reservado de AWS S3 o proveedores compatibles (MinIO, R2, etc.) y genera URLs firmadas para su lectura/eliminación administrada.

## Relaciones Polimórficas (`FileEntity`)
En lugar de tener columnas estáticas para adjuntos (ej: `avatarId`, `documentId`), los archivos se asocian de forma polimórfica.
Cada fila en la tabla `file` guarda información sobre a quién pertenece usando:
- `entity`: Nombre del modelo/entidad propietaria (ej: `'User'`, `'Post'`).
- `entityId`: El UUID o identificador del registro al que está enlazado.

Esto nos permite adjuntar N archivos a cualquier entidad sin modificar la estructura de las tablas destino.

## Limpieza Automática (Garbage Collection & Subscribers)
Para garantizar consistencia y prevenir archivos "fantasma" en S3 o en disco, hemos implementado una limpieza "en cascada" guiada por Eventos de TypeORM.

### 1. `GlobalFileCleanupSubscriber`
Escucha **todas** las eliminaciones en la base de datos (mediante `beforeRemove`).
- **Qué hace:** Identifica qué entidad está siendo destruida, busca todos los registros `FileEntity` que tengan `entityName` y `entityId` coincidentes y ejecuta un borrado por lote (usando `remove()`).
- **Por qué:** Unifica la limpieza. Si se elimina un usuario, no hay que ejecutar lógica de borrado de archivos ni en el servicio de usuarios, este subscriber lo detecta globalmente.

### 2. Subscribers Duros (S3 & Local)
Tenemos dos subscribers específicos que solo escuchan la eliminación del `FileEntity` (a través de `afterRemove`).
- **`FileS3Subscriber`**: Captura la eliminación de la fila y usa el cliente configurado de AWS S3 para borrar el archivo alojado remotamente. Solo se carga cuando el driver S3 está activo.
- **`FileLocalSubscriber`**: Captura la eliminación de la fila y usa la API nativa de Node.js (`fs`) para localizar y borrar el recurso del disco local. Solo se carga cuando el driver Local está activo.

### El Flujo Completo
```mermaid
sequenceDiagram
    participant App as Any Repository
    participant GlobalSub as GlobalFileCleanupSubscriber
    participant FileRepo as FileEntity Repository
    participant StorageSub as Storage Subscriber (S3/Local)
    participant Disk as AWS S3 / Disk

    App->>App: .remove({ id: 1 })
    GlobalSub->>App: Intercepta 'beforeRemove'
    GlobalSub->>FileRepo: find({ entity: 'User', entityId: '1' })
    FileRepo->>GlobalSub: return [Files...]
    GlobalSub->>FileRepo: .remove([Files...])
    StorageSub->>FileRepo: Intercepta 'afterRemove' en File
    StorageSub->>Disk: .deletePhysicalFile(file.path)
    Disk-->>StorageSub: OK
    Note right of StorageSub: Borrado Físico completado
```

### ⚠️ Reglas importantes para que el flujo funcione
> [!IMPORTANT]
> **Ninguno de estos subscribers se activa si usas `.delete()` directa o `QueryBuilder`**.
Para que TypeORM desencadene la lógica, SIEMPRE se debe recuperar las entidades y utilizar el método `.remove()` o `.softRemove()` del repositorio.
