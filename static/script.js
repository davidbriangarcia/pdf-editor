document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const pdfUpload = document.getElementById('pdfUpload');
    const addControls = document.getElementById('add-controls');
    const textInput = document.getElementById('textInput');
    const addTextBtn = document.getElementById('addTextBtn');
    const imageUpload = document.getElementById('imageUpload');
    const addImageBtn = document.getElementById('addImageBtn');
    const savePdfBtn = document.getElementById('savePdfBtn');
    const status = document.getElementById('status');
    const pdfViewer = document.getElementById('pdf-viewer');
    const pageContainer = document.getElementById('page-container');
    const pageImage = document.getElementById('page-image');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageIndicator = document.getElementById('pageIndicator');
    const downloadLink = document.getElementById('downloadLink');

    // --- Estado de la Aplicación ---
    let currentPdfFilename = null;
    let currentPageNum = 0;
    let totalPages = 0;
    let edits = []; // Almacena todas las ediciones [{type, page, x, y, text?, image_data?, ...}]
    let currentAction = null; // 'text' o 'image'
    let currentImageData = null; // Base64 de la imagen a añadir

    // --- Manejadores de Eventos ---

    pdfUpload.addEventListener('change', handlePdfUpload);
    addTextBtn.addEventListener('click', () => prepareAction('text'));
    addImageBtn.addEventListener('click', () => prepareAction('image'));
    imageUpload.addEventListener('change', handleImageUpload);
    pageImage.addEventListener('click', handlePageClick);
    prevPageBtn.addEventListener('click', showPrevPage);
    nextPageBtn.addEventListener('click', showNextPage);
    savePdfBtn.addEventListener('click', savePdf);

    // --- Funciones ---

    async function handlePdfUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        status.textContent = 'Subiendo y procesando PDF...';
        const formData = new FormData();
        formData.append('pdfFile', file);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al subir el PDF.');
            }

            const data = await response.json();
            currentPdfFilename = data.filename;
            totalPages = data.page_count;
            currentPageNum = 0;
            edits = []; // Limpiar ediciones anteriores
            updatePageIndicator();
            loadPage(currentPageNum);
            addControls.style.display = 'block';
            savePdfBtn.disabled = false;
            status.textContent = 'PDF cargado. Haz clic en la página para añadir elementos.';
            downloadLink.innerHTML = '';

        } catch (error) {
            status.textContent = `Error: ${error.message}`;
            console.error('Upload failed:', error);
            addControls.style.display = 'none';
        }
    }

    async function loadPage(pageNum) {
        if (!currentPdfFilename || pageNum < 0 || pageNum >= totalPages) return;

        status.textContent = `Cargando página ${pageNum + 1}...`;
        pageImage.src = ''; // Limpiar imagen anterior
        pageImage.style.display = 'none';

        try {
            const response = await fetch(`/pdf/${currentPdfFilename}/page/${pageNum}`);
            if (!response.ok) throw new Error('No se pudo cargar la página.');

            const data = await response.json();
            pageImage.src = `data:image/png;base64,${data.image_data}`;
            pageImage.style.display = 'block';
            currentPageNum = pageNum;
            updatePageIndicator();
            updatePaginationButtons();
            status.textContent = 'Página cargada. Haz clic para añadir.';
            renderEditsForCurrentPage();

        } catch (error) {
            status.textContent = `Error: ${error.message}`;
            console.error('Page load failed:', error);
        }
    }

    function updatePageIndicator() {
        pageIndicator.textContent = `Página ${currentPageNum + 1} / ${totalPages}`;
    }

    function updatePaginationButtons() {
        prevPageBtn.disabled = currentPageNum <= 0;
        nextPageBtn.disabled = currentPageNum >= totalPages - 1;
    }

    function showPrevPage() {
        if (currentPageNum > 0) {
            loadPage(currentPageNum - 1);
        }
    }

    function showNextPage() {
        if (currentPageNum < totalPages - 1) {
            loadPage(currentPageNum + 1);
        }
    }

    function prepareAction(type) {
        if (type === 'text' && !textInput.value.trim()) {
            alert('Por favor, escribe el texto que quieres añadir.');
            return;
        }
        if (type === 'image' && !currentImageData) {
             alert('Por favor, selecciona una imagen antes de añadirla.');
             return;
        }
        currentAction = type;
        status.textContent = `Haz clic en la página para añadir ${type === 'text' ? 'el texto' : 'la imagen'}.`;
        status.style.fontSize = '2em';
        pageImage.style.cursor = 'crosshair';
    }

    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            currentImageData = e.target.result; // Contiene 'data:image/png;base64,...'
            status.textContent = 'Imagen lista. Haz clic en "Añadir Imagen" y luego en la página.';
            status.style.fontSize = '2em';
        };
        reader.onerror = () => {
             status.textContent = 'Error al leer la imagen.';
             currentImageData = null;
        };
        reader.readAsDataURL(file);
    }

    function handlePageClick(event) {
        if (!currentAction) return; // No hacer nada si no hay acción pendiente

        const rect = pageImage.getBoundingClientRect();
        const scaleX = pageImage.naturalWidth / pageImage.width;
        const scaleY = pageImage.naturalHeight / pageImage.height;

        // Coordenadas relativas (0 a 1) para enviar al backend
        const relativeX = (event.clientX - rect.left) / rect.width;
        const relativeY = (event.clientY - rect.top) / rect.height;

        // Coordenadas en píxeles para la visualización
        const displayX = event.clientX - rect.left;
        const displayY = event.clientY - rect.top;

        let newEdit = {
            page: currentPageNum,
            x: relativeX,
            y: relativeY,
            id: `edit-${Date.now()}` // ID único para poder eliminarlo
        };

        if (currentAction === 'text') {
            newEdit.type = 'text';
            newEdit.text = textInput.value;
            newEdit.size = 11; // Puedes añadir un input para esto
            textInput.value = ''; // Limpiar input
        } else if (currentAction === 'image') {
            newEdit.type = 'image';
            newEdit.image_data = currentImageData;
            newEdit.width = 100; // Valor inicial en píxeles
            newEdit.height = 100;
            newEdit.page_image_width = pageImage.width;
            newEdit.page_image_height = pageImage.height;
            imageUpload.value = '';
            currentImageData = null;
        }

        edits.push(newEdit);
        addVisualMarker(newEdit, displayX, displayY);

        currentAction = null; // Resetear acción
        pageImage.style.cursor = 'default';
        status.textContent = 'Elemento añadido. Puedes añadir más o guardar.';
    }

    function addVisualMarker(edit, displayX, displayY) {
        const marker = document.createElement('div');
        marker.classList.add('visual-marker');
        marker.style.left = `${displayX}px`;
        marker.style.top = `${displayY}px`;
        marker.dataset.id = edit.id;

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'X';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // Evitar que el clic se propague a la página
            removeEdit(edit.id);
        };
        marker.appendChild(deleteBtn);

        if (edit.type === 'text') {
            marker.textContent = edit.text;
            marker.appendChild(deleteBtn); // Añadir de nuevo porque textContent lo sobreescribe
        } else if (edit.type === 'image') {
            const img = document.createElement('img');
            img.src = edit.image_data;
            // Usar tamaño absoluto en píxeles
            img.style.width = `${edit.width}px`;
            img.style.height = `${edit.height}px`;
            marker.appendChild(img);
            marker.appendChild(deleteBtn);

            // Permitir mover
            marker.onmousedown = function(e) {
                if (e.target === deleteBtn) return;
                e.preventDefault();
                let startX = e.clientX, startY = e.clientY;
                let origX = marker.offsetLeft, origY = marker.offsetTop;

                function onMouseMove(ev) {
                    let dx = ev.clientX - startX;
                    let dy = ev.clientY - startY;
                    let newLeft = origX + dx;
                    let newTop = origY + dy;
                    marker.style.left = `${newLeft}px`;
                    marker.style.top = `${newTop}px`;

                    // Actualiza las coordenadas relativas en el objeto edit
                    const rect = pageImage.getBoundingClientRect();
                    edit.x = newLeft / rect.width;
                    edit.y = newTop / rect.height;
                }

                function onMouseUp() {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                }

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };

            // Permitir redimensionar (esquina inferior derecha)
            const resizeHandle = document.createElement('div');
            resizeHandle.style.width = '12px';
            resizeHandle.style.height = '12px';
            resizeHandle.style.background = 'rgba(0,0,0,0.3)';
            resizeHandle.style.position = 'absolute';
            resizeHandle.style.right = '0';
            resizeHandle.style.bottom = '0';
            resizeHandle.style.cursor = 'nwse-resize';
            marker.appendChild(resizeHandle);

            resizeHandle.onmousedown = function(e) {
                e.stopPropagation();
                e.preventDefault();
                let startX = e.clientX, startY = e.clientY;
                let startWidth = marker.offsetWidth, startHeight = marker.offsetHeight;
                const aspectRatio = startWidth / startHeight;

                function onMouseMove(ev) {
                    let dx = ev.clientX - startX;
                    let newWidth = Math.max(30, startWidth + dx);
                    let newHeight = newWidth / aspectRatio; // Mantener proporción
                    marker.style.width = `${newWidth}px`;
                    marker.style.height = `${newHeight}px`;
                    img.style.width = `${newWidth}px`;
                    img.style.height = `${newHeight}px`;

                    // Actualiza tamaño absoluto en píxeles
                    edit.width = newWidth;
                    edit.height = newHeight;
                    edit.page_image_width = pageImage.width;
                    edit.page_image_height = pageImage.height;
                }

                function onMouseUp() {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                }

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };
        }

        pageContainer.appendChild(marker);
    }

    function removeEdit(id) {
        edits = edits.filter(edit => edit.id !== id);
        const markerToRemove = document.querySelector(`.visual-marker[data-id="${id}"]`);
        if (markerToRemove) {
            markerToRemove.remove();
        }
         status.textContent = 'Elemento eliminado.';
    }

    function renderEditsForCurrentPage() {
        // Limpiar marcadores visuales existentes
        document.querySelectorAll('.visual-marker').forEach(m => m.remove());

        // Renderizar marcadores para la página actual
        edits.forEach(edit => {
            if (edit.page === currentPageNum) {
                const rect = pageImage.getBoundingClientRect();
                const displayX = edit.x * rect.width;
                const displayY = edit.y * rect.height;
                addVisualMarker(edit, displayX, displayY);
            }
        });
    }

    async function savePdf() {
        if (!currentPdfFilename || edits.length === 0) {
            alert('No hay nada que guardar o no se ha cargado un PDF.');
            return;
        }

        status.textContent = 'Guardando PDF modificado...';
        savePdfBtn.disabled = true;

        // Preparar datos para enviar (excluir el ID visual)
        const editsToSend = edits.map(({ id, ...rest }) => rest);

        try {
            const response = await fetch('/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: currentPdfFilename,
                    edits: editsToSend,
                }),
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || 'Error al guardar el PDF.');
            }

            const data = await response.json();
            status.textContent = 'PDF guardado con éxito.';
            downloadLink.innerHTML = `<a href="${data.download_url}" target="_blank" download>Descargar PDF Modificado</a>`;

        } catch (error) {
            status.textContent = `Error: ${error.message}`;
            console.error('Save failed:', error);
        } finally {
            savePdfBtn.disabled = false;
        }
    }
});