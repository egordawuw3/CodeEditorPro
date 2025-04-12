let editor;
let pyodideInstance = null;

const SUPPORTED_LANGUAGES = {
    javascript: { name: 'JavaScript', ext: 'js', icon: '⚡️' },
    python: { name: 'Python', ext: 'py', icon: '🐍' },
    html: { name: 'HTML', ext: 'html', icon: '🌐' }
};

const THEMES = [
    { id: 'monokai', name: '⚫️ Тёмная' },
    { id: 'dracula', name: '🌑 Чёрная' },
    { id: 'material', name: '🌘 Серая' },
    { id: 'nord', name: '⭐️ Классическая' },
    { id: 'solarized', name: '💫 Контрастная' }
];

document.addEventListener('DOMContentLoaded', () => {
    initializeEditor();
    initializeLanguageSelect();
    initializeThemeSelect();
    setupEventListeners();
    loadSavedState();
});

function initializeEditor() {
    editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
        lineNumbers: true,
        mode: 'javascript',
        theme: 'material', // меняем дефолтную тему на material
        autoCloseBrackets: true,
        matchBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        lineWrapping: true,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        extraKeys: {
            "Ctrl-Space": "autocomplete",
            "Ctrl-/": "toggleComment",
            "Ctrl-F": "findPersistent"
        },
        autoCloseTags: true,
        matchTags: true,
        highlightSelectionMatches: true,
        styleActiveLine: true
    });
}

function initializeLanguageSelect() {
    const languageSelect = document.getElementById('language-select');
    Object.entries(SUPPORTED_LANGUAGES).forEach(([value, lang]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = `${lang.icon} ${lang.name}`;
        languageSelect.appendChild(option);
    });
}

function initializeThemeSelect() {
    const themeSelect = document.getElementById('theme-select');
    THEMES.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme.id;
        option.textContent = theme.name;
        themeSelect.appendChild(option);
    });
}

function setupEventListeners() {
    document.getElementById('theme-select').addEventListener('change', (e) => {
        const theme = e.target.value;
        editor.setOption('theme', theme);
        localStorage.setItem('savedTheme', theme);
    });

    document.getElementById('language-select').addEventListener('change', (e) => {
        const language = e.target.value;
        const runBtn = document.getElementById('run-btn');
        
        editor.setOption('mode', language);
        localStorage.setItem('savedLanguage', language);
        
        if (language === 'html') {
            runBtn.querySelector('.btn-text').textContent = 'Preview';
        } else {
            runBtn.querySelector('.btn-text').textContent = 'Run';
            document.querySelector('.preview-container').classList.remove('active');
        }
    });

    document.getElementById('run-btn').addEventListener('click', executeCode);
    document.getElementById('new-file').addEventListener('click', newFile);
    document.getElementById('save-file').addEventListener('click', saveFile);
    document.getElementById('copy-code').addEventListener('click', copyToClipboard);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key.toLowerCase()) {
                case 's':
                    e.preventDefault();
                    saveFile();
                    break;
                case 'n':
                    e.preventDefault();
                    newFile();
                    break;
                case 'd':
                    e.preventDefault();
                    copyToClipboard();
                    break;
                case 'enter':
                    e.preventDefault();
                    executeCode();
                    break;
            }
        }
    });

    setInterval(() => {
        localStorage.setItem('savedCode', editor.getValue());
    }, 5000);
}

function loadSavedState() {
    const savedCode = localStorage.getItem('savedCode');
    const savedLanguage = localStorage.getItem('savedLanguage');
    const savedTheme = localStorage.getItem('savedTheme');

    if (savedCode) editor.setValue(savedCode);
    if (savedLanguage) {
        document.getElementById('language-select').value = savedLanguage;
        editor.setOption('mode', savedLanguage);
    }
    if (savedTheme) {
        document.getElementById('theme-select').value = savedTheme;
        editor.setOption('theme', savedTheme);
    }
}

async function executeCode() {
    const code = editor.getValue();
    const language = document.getElementById('language-select').value;
    const runBtn = document.getElementById('run-btn');
    const output = document.getElementById('output');
    const previewContainer = document.querySelector('.preview-container');

    if (language === 'html') {
        previewContainer.classList.add('active');
        previewContainer.innerHTML = `
            <div class="preview-header">
                <button class="close-preview-btn">✕</button>
            </div>
            <iframe class="preview-frame" srcdoc="${code.replace(/"/g, '&quot;')}"></iframe>
        `;
        
        previewContainer.querySelector('.close-preview-btn').addEventListener('click', () => {
            previewContainer.classList.remove('active');
        });
        return;
    }

    previewContainer.classList.remove('active');
    output.innerHTML = '';
    runBtn.classList.add('loading');
    const startTime = performance.now();

    try {
        if (language === 'javascript') {
            const oldLog = console.log;
            let logs = [];
            console.log = (...args) => {
                logs.push(args.join(' '));
            };

            await new Promise(resolve => setTimeout(resolve, 0));
            eval(code);

            console.log = oldLog;
            output.innerHTML = `
                <div class="success-message">Код успешно выполнен!</div>
                <div class="output-content">${logs.join('<br>')}</div>
            `;
        } else if (language === 'python') {
            output.innerHTML = '<div class="loading-message">Загрузка Python интерпретатора...</div>';
            
            if (!pyodideInstance) {
                pyodideInstance = await loadPyodide({
                    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/"
                });
            }
        
            pyodideInstance.runPython(`
                import sys
                from io import StringIO
                sys.stdout = StringIO()
            `);
        
            await pyodideInstance.loadPackagesFromImports(code);
            await pyodideInstance.runPythonAsync(code);
            
            const stdout = pyodideInstance.runPython("sys.stdout.getvalue()");
            output.innerHTML = `
                <div class="success-message">Python код успешно выполнен!</div>
                <div class="output-content">${stdout}</div>
            `;
        }
    } catch (error) {
        output.innerHTML = `
            <div class="error-message">
                <strong>Error:</strong> ${error.message}
            </div>
        `;
    } finally {
        const endTime = performance.now();
        const executionTime = (endTime - startTime).toFixed(2);
        
        output.innerHTML += `
            <div class="execution-time">
                Время выполнения: ${executionTime}мс
            </div>
        `;
        
        runBtn.classList.remove('loading');
    }
}

function saveFile() {
    const code = editor.getValue();
    const language = document.getElementById('language-select').value;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${SUPPORTED_LANGUAGES[language].ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('File saved!');
}

function newFile() {
    if (editor.getValue().trim() !== '') {
        if (confirm('Create new file? Unsaved changes will be lost.')) {
            editor.setValue('');
            showNotification('New file created');
        }
    } else {
        editor.setValue('');
    }
}

async function copyToClipboard() {
    try {
        await navigator.clipboard.writeText(editor.getValue());
        showNotification('Code copied to clipboard');
    } catch (err) {
        showNotification('Failed to copy code', 'error');
    }
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${type === 'success' ? '✅' : '⚠️'}</span>
            <span class="notification-message">${message}</span>
        </div>
    `;
    const container = document.querySelector('.notification-container') || 
        (() => {
            const cont = document.createElement('div');
            cont.className = 'notification-container';
            document.body.appendChild(cont);
            return cont;
        })();
    
    container.appendChild(notification);
    
    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    });

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => container.removeChild(notification), 300);
    }, 2000);
}