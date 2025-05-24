import fitz  # PyMuPDF
import os
import io
import base64
import json
from flask import Flask, request, render_template, jsonify, send_from_directory

# --- Configuración ---
UPLOAD_FOLDER = 'uploads'
MODIFIED_FOLDER = 'modified'
ALLOWED_EXTENSIONS = {'pdf'}

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MODIFIED_FOLDER'] = MODIFIED_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # 16 MB max size

# Crear carpetas si no existen
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(MODIFIED_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Rutas ---

@app.route('/')
def index():
    """Renderiza la página principal."""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_pdf():
    """Maneja la subida del PDF."""
    if 'pdfFile' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['pdfFile']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = file.filename # Usar un nombre seguro en producción
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        try:
            doc = fitz.open(filepath)
            page_count = doc.page_count
            doc.close()
            return jsonify({'filename': filename, 'page_count': page_count})
        except Exception as e:
            return jsonify({'error': f'Could not process PDF: {e}'}), 500
    else:
        return jsonify({'error': 'File type not allowed'}), 400

@app.route('/pdf/<filename>/page/<int:page_num>')
def get_pdf_page(filename, page_num):
    """Convierte una página del PDF a imagen y la envía como Base64."""
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404

    try:
        doc = fitz.open(filepath)
        if 0 <= page_num < doc.page_count:
            page = doc.load_page(page_num)
            # Renderizar a 150 DPI para mejor calidad en pantalla
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")
            img_base64 = base64.b64encode(img_bytes).decode('utf-8')
            doc.close()
            return jsonify({
                'image_data': img_base64,
                'width': pix.width,
                'height': pix.height
            })
        else:
            doc.close()
            return jsonify({'error': 'Page number out of range'}), 404
    except Exception as e:
        return jsonify({'error': f'Could not load page: {e}'}), 500

@app.route('/edit', methods=['POST'])
def edit_pdf():
    """Aplica las ediciones (texto e imágenes) al PDF y lo guarda."""
    data = request.json
    filename = data.get('filename')
    edits = data.get('edits', [])

    if not filename:
        return jsonify({'error': 'Filename missing'}), 400

    original_filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    modified_filename = f"edited_{filename}"
    modified_filepath = os.path.join(app.config['MODIFIED_FOLDER'], modified_filename)

    if not os.path.exists(original_filepath):
        return jsonify({'error': 'Original file not found'}), 404

    try:
        doc = fitz.open(original_filepath)

        for edit in edits:
            page_num = edit.get('page')
            edit_type = edit.get('type')
            x = edit.get('x') # Coordenada X relativa (0 a 1)
            y = edit.get('y') # Coordenada Y relativa (0 a 1)

            if page_num is None or x is None or y is None:
                continue # Saltar ediciones incompletas

            page = doc.load_page(page_num)
            page_rect = page.rect

            # Calcular coordenadas absolutas en puntos PDF
            pdf_x = (x * page_rect.width) 
            pdf_y = (y * page_rect.height) 

            if edit_type == 'text':
                text = edit.get('text', '')
                size = edit.get('size', 11)
                # Ajusta la posición Y sumando un poco más de la mitad del tamaño de fuente
                adjusted_pdf_y = pdf_y + size * 0.3
                point = fitz.Point(pdf_x, adjusted_pdf_y)
                rc = page.insert_text(point, text, fontsize=size, fontname="helv", color=(0, 0, 0)) # Negro

            elif edit_type == 'image':
                img_data_b64 = edit.get('image_data')
                px_w = edit.get('width', 100)   # Ancho en píxeles absolutos
                px_h = edit.get('height', 100)  # Alto en píxeles absolutos

                page_img_w = edit.get('page_image_width')  # ancho en px de la imagen renderizada en JS
                page_img_h = edit.get('page_image_height') # alto en px de la imagen renderizada en JS

                if img_data_b64 and page_img_w and page_img_h:
                    # Quitar el prefijo 'data:image/png;base64,'
                    if ',' in img_data_b64:
                        img_data_b64 = img_data_b64.split(',', 1)[1]

                    img_bytes = base64.b64decode(img_data_b64)
                    img_stream = io.BytesIO(img_bytes)

                    # Convertir píxeles a puntos PDF usando la proporción entre la imagen renderizada y la página PDF
                    img_w = (px_w / page_img_w) * page_rect.width
                    img_h = (px_h / page_img_h) * page_rect.height

                    # rect = fitz.Rect(pdf_x, pdf_y, pdf_x + img_w, pdf_y + img_h)
                    rect = fitz.Rect(pdf_x, pdf_y - img_h / 2, pdf_x + img_w, pdf_y + img_h / 2)
                    page.insert_image(rect, stream=img_stream)

        doc.save(modified_filepath)
        doc.close()
        return jsonify({'download_url': f'/download/{modified_filename}'})

    except Exception as e:
        print(f"Error during PDF editing: {e}")
        return jsonify({'error': f'Failed to edit PDF: {e}'}), 500

@app.route('/download/<filename>')
def download_file(filename):
    """Permite la descarga del PDF modificado."""
    return send_from_directory(app.config['MODIFIED_FOLDER'], filename, as_attachment=True)

# --- Ejecución ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)