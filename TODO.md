Acabar comprobar el i18n, comprobar el zod locale y comprobar la funcionalidad de las generadores de modulos

- [] Probar la generación de modulos relaciones etc.
- [x] Mejorar el modulo de archivos (subscriber de eliminar archivos al eliminar el recurso, etc) (mirar gemini)
- [x] Control de errores de backend y frontend (mirar gemini)
- [x] Modulo de CMS (mirar gemini)
  - IA con CMS
  - Probar que todo funcione correctamente
  - No funciona la creación de blogs que debería hacer? 1. Al darle a crear, se crearía un borrador. 2. Las imagenes subidas se relacionarían con el blog. 4. Los textos deben subirse en la tabla de traducciones con el entityName y entityId del blog para luego mostrarlos en el editor. 5. Si ya hay imagenes subidas para ese blog, estarán disponibles en el editor de los otros idiomas, para reutilizarlas. 6. Se podrá utilizar la IA para traducir todos los inputs del blog. 7. Habrá un botón de preview 8. En el mismo editor aparecerá un botón de publicar o despublicar. A parte de guardar los cambios.
  - El SEO
  - Traducciones

---

- [x] Dejar organizado el proyecto
  - [x] Backend unir en carpetas modulos
  - [x] Frontend unir en carpetas los componentes
- [x] Eliminar el authz basado en permisos y mejor en roles
- [] Probar de asegurar un enpoint con decorador de roles y si es el mismo usuario del recurso y en el front tambien
- [x] Crear documentación de como usar el proyecto y como esta organizado
- [] Revisar los api tokens
- [] Estandarizador de implementar Webhooks (crear observers)

---

- Unir los modulos base en un uno en el front
- en las traducciones, añadir un sidebar derecho donde muestre todos los tokens de la página, con un buscador y un toggle para hacer highlight de todos los de la página, al hacer hover a un token del sidebar también se hace highlight en la página. Al hacer click mostraría el modal de edición
- Probar que todo funcione y pensar como funciona el sync en despliegue, solo mostrar el boton flotante en dev

---

Herramientas cli:

- [] Añadir más tipos de campos (DateTime, JSON, Cords, etc All types of postgres and typeorm)
- [] Que acepte JSON como argumento
- [] Crear skill para gemini

Componentes:

- [] Componente tabla aislado + exportador a csv/json
- [] Componente formulario aislado
- [] Documentación de los componentes + la combinación

---

Más alla:

- [] Login con google
- [] Recuperador de contraseña
- [] 2FA
- [] Planear estandarización de crear modulos

Modulos:

- [] Stripe pagos:
  - [] Planes mensuales
  - [] Planes anuales
  - [] Suscripciones
  - [] Pagos
  - [] Balance
  - [] Customer portal
  - [] Test
  - [] Documentación
- [] Newsletter:
  - [] Suscripciones
  - [] Campañas
  - [] Documentación
- [] Traducciones
- [] CMS
- [] Flujo de generación de contenido con IA
  - [] Videos
    - [] Ad de producto
    - [] Persona IA
    - [] Infografias etc
  - [] Blogs
- [] Flujo subida a todas las redes sociales
- [] Agente IA con el conocimiento del negocio
- [] Incidencias
- [] Gestor de tareas
- [] Chatbots y llamadas IA
