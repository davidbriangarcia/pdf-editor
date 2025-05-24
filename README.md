# ✍️ Editor Web de Contratos PDF

Este es un editor web de contratos en formato PDF desarrollado con Flask y PyMuPDF. Permite añadir **texto personalizado** e **imágenes (como firmas o huellas)** sobre páginas específicas de un documento PDF, directamente desde el navegador.

---

## 🚀 Características

- 📤 Subida de archivos PDF de múltiples páginas.
- 👁️ Navegación por páginas del PDF desde el navegador.
- ✏️ Inserción de texto en coordenadas específicas.
- 🖼️ Inserción de imágenes (firma, huella, etc.) en cualquier parte del documento.
- 📦 Posibilidad de mover y redimensionar imágenes dentro del lienzo.
- 💾 Guardar y descargar el PDF modificado con todas las ediciones aplicadas.

---

## Desplegado en https://pale-vegetables-highland-pockets.trycloudflare.com/

---

🖱️ Guía paso a paso

🔹 Cargar el PDF


Haz clic en “Seleccionar archivo” y elige tu contrato en PDF.


Se mostrará una vista previa de las páginas.


🔹 Añadir texto


Escribe el contenido en el campo de texto (por ejemplo: nombre, DNI, fecha).


Haz clic en el botón “Añadir texto”.


Luego haz clic sobre el lienzo en el lugar donde quieras insertar el texto.


🔹 Añadir imagen

Usa el selector de archivo para elegir una imagen (firma, huella, etc.).


Presiona el botón “Añadir imagen”.


Haz clic en el lienzo donde desees colocarla.


Puedes mover y redimensionar la imagen antes de guardar.

🔹 Guardar y descargar

Una vez finalizadas tus ediciones, haz clic en “Guardar PDF Editado”.


Se generará una versión final del documento con las modificaciones.


El navegador iniciará automáticamente la descarga del archivo final.


📌 Notas
Los cambios solo se aplican después de hacer clic en el lienzo (ubicación de texto o imagen).

Los archivos subidos se almacenan temporalmente en la carpeta static/uploads/.

🧑‍💻 Autor
Desarrollado por [davidbriangarcia].# pdf-editor
