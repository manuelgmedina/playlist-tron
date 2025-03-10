console.log('1. Iniciando el script...');
const express = require('express');
console.log('2. Express cargado');
const app = express();
console.log('3. App creada');
const router = express.Router();
console.log('4. Router creado');

router.get('/test', (req, res) => {
  res.send('¡Funciona!');
});
console.log('5. Ruta /test definida');

app.use('/api', router);
console.log('6. Middleware /api configurado');

app.listen(3000, () => {
  console.log('7. Servidor corriendo en http://localhost:3000');
});
console.log('8. app.listen llamado (esto aparece antes de que el servidor esté listo)');