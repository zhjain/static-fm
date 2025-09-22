const logger = require('../utils/logger');

const pinoHttp = require('pino-http')({
    logger: logger,
    autoLogging: true,
    useLevel: 'info',
    customSuccessMessage: function(req, res) {
        return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage: function(req, res, err) {
        return `${req.method} ${req.url} ${res.statusCode} ${err.message}`;
    },
    serializers: {
        req: (req) => {
            return {
                method: req.method,
                url: req.url,
                remoteAddress: req.remoteAddress || req.ip
            };
        },
        res: (res) => {
            return {
                statusCode: res.statusCode,
                headers: {
                    'content-length': res.headers['content-length']
                }
            };
        }
    }
});

module.exports = pinoHttp;