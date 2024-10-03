import express from 'express';
import fs from 'fs';

const app = express();
const PORT = 2086;
const logFilePath  =  '/var/log/v2ray/access.log'; // Ajuste o caminho para o seu arquivo de log
let totalUsers = 0;

// Função para processar os logs
function processLogs(logs) {
    const logEntries = logs.split('\n').filter(entry => entry.trim() !== '');
    const currentTime = new Date();
    const onlineUsers = new Set();
    const uniqueEmails = new Set();

    logEntries.forEach(entry => {
        const regex = /(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})\s+([\d.]+):\d+\s+(accepted|rejected)\s+(\S+):(\S+)\s+email:\s+([\w.-]+@[\w.-]+)/;
        const match = entry.match(regex);

        if (match) {
            const [_, timestamp, ip, status, protocol, port, email] = match;
            const logDate = new Date(timestamp);

            // Adiciona o usuário se o status for 'accepted' e dentro do limite de 10 minutos
            if (status === 'accepted' && (currentTime - logDate <= 5 * 60 * 1000)) {
                onlineUsers.add(email);
            }
            // Adiciona todos os emails ao conjunto de emails únicos
            uniqueEmails.add(email);
        }
    });

    return {
        onlineUsers: Array.from(onlineUsers), // Convertendo para array
        totalOnline: onlineUsers.size,
        uniqueEmails: Array.from(uniqueEmails), // Adicionando emails únicos
        totalUniqueEmails: uniqueEmails.size // Total de emails únicos
    };
}

// Ler o arquivo de logs
fs.readFile(logFilePath, 'utf8', (err, data) => {
    if (err) {
        // console.error('Erro ao ler o arquivo de logs:', err);
        return;
    }

    const logAnalysis = processLogs(data);
    // console.log('Usuários online:', logAnalysis.onlineUsers);
    // console.log('Total de usuários online:', logAnalysis.totalOnline);
});

// Função para contar usuários únicos
function countUniqueUsers() {
    try {
        const logs = fs.readFileSync(logFilePath , 'utf-8');
        const logAnalysis = processLogs(logs);
        totalUsers = logAnalysis.totalOnline; // Use totalUniqueEmails para obter o total
        // console.log(`Total de usuários online: ${totalUsers}`);
    } catch (error) {
        // console.error('Erro ao ler o arquivo de log:', error);
    }
}

// Função para limpar logs antigos
function cleanOldLogs() {
    try {
        const logs = fs.readFileSync(logFilePath , 'utf-8');
        const lines = logs.split('\n').filter(line => line.trim() !== '');

        if (lines.length === 0) {
            // console.log('Nenhum log para limpar.');
            return;
        }

        // console.log('Iniciando a limpeza de logs...');

        // Captura a data e hora da última linha
        const lastLine = lines[lines.length - 1];
        const lastTimestamp = lastLine.split(' ')[0]; // Pega apenas a parte da data
        const lastTime = lastLine.split(' ')[1]; // Pega o tempo

        if (!lastTime) {
            // console.log('Erro: O tempo da última linha não foi encontrado.');
            return;
        }
        
        // console.log(`Último log encontrado: ${lastTimestamp} ${lastTime}`);

        // Converte o tempo da última linha para um objeto Date
        const [lastYear, lastMonth, lastDay] = lastTimestamp.split('/').map(Number);
        const [lastHour, lastMinute] = lastTime.split(':').map(Number);
        
        // Cria a data do último log
        const lastLogDate = new Date(lastYear, lastMonth - 1, lastDay, lastHour, lastMinute);

        // Diminui 1 hora no valor
        lastLogDate.setHours(lastLogDate.getHours() - 1);
        // console.log(`Data limite para manter os logs (1 hora antes): ${lastLogDate}`);

        // Encontrar a linha correspondente ao tempo diminuído
        const cutoffIndex = lines.findIndex(line => {
            const [timestamp, time] = line.split(' ').slice(0, 2);
            const [year, month, day] = timestamp.split('/').map(Number);
            const [hour, minute] = time.split(':').map(Number);
            const logDate = new Date(year, month - 1, day, hour, minute);

            return logDate.getTime() === lastLogDate.getTime(); // Compara somente o tempo
        });

        // Se não encontrar a linha correspondente, usar o último log
        const indexToKeep = cutoffIndex === -1 ? lines.length - 1 : cutoffIndex;

        // console.log(`Manter logs a partir da linha: ${indexToKeep}`);

        // Filtrar logs para manter
        const recentLogs = lines.slice(indexToKeep);

        // console.log(`Total de logs a serem mantidos: ${recentLogs.length}`);
        // console.log(`Total de logs a serem removidos: ${lines.length - recentLogs.length}`);

        // Escrever os logs filtrados de volta no arquivo
        fs.writeFileSync(logFilePath , recentLogs.join('\n'), 'utf-8');
        // console.log('Logs antigos removidos, mantendo apenas os logs a partir da linha correspondente.');
    } catch (error) {
        // console.error('Erro ao limpar logs:', error);
    }
}

// Rota para retornar o total de usuários online
app.get('/users', (req, res) => {
    const token = req.query.token;
    if (token === 'b2c1f84a1d3e92f63e1d73c7e55b8a19a93d5b405c5d88f7f367e27c084df0a7') {
        res.json({ onlineUsers: totalUsers });
    } else {
        res.status(403).json({ error: 'Token inválido' });
    }
});

// Atualiza o total de usuários a cada 10 segundos
setInterval(countUniqueUsers, 10000);

// Limpa logs antigos a cada hora
setInterval(cleanOldLogs, 3600000);

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
