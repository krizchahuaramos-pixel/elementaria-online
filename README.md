# Elementaria - Version Online (Multijugador)

Esta es la version multijugador de Elementaria. El juego sigue siendo el mismo
RPG de particulas, pero ahora se ejecuta sobre un pequeno servidor para que
varias personas jueguen conectadas a la vez.

## Que es multijugador real en esta version

- **Presencia en el mapa**: ves a los demas jugadores moverse por el Campo
  abierto en tiempo real (cada uno con su color y la inicial de su nombre).
- **Chat en tiempo real**: los mensajes del chat (tecla T) llegan a todos los
  jugadores conectados, con globo de texto sobre cada personaje.
- **Tabla de clasificacion online**: ademas de tus cuentas locales, la tabla
  muestra a los jugadores conectados en ese momento.

> El resto del juego (batallas contra elementos, inventario, tienda, el 1v1
> local, guardado por cuenta) funciona igual que en la version individual.

## Como ejecutarlo

Necesitas tener instalado **Node.js 18 o superior**.

1. Abre una terminal dentro de esta carpeta.
2. Instala las dependencias (solo la primera vez):

   ```bash
   npm install
   ```

3. Arranca el servidor:

   ```bash
   npm start
   ```

4. Abre el navegador en:

   ```
   http://localhost:3000
   ```

   Abre esa misma direccion en varias pestanas o equipos para probar el
   multijugador.

## Jugar con amigos en la misma red

Mientras el servidor esta arrancado, comparte a tus amigos tu IP local
(por ejemplo `http://192.168.1.50:3000`). Todos deben estar en la misma red.

Puedes cambiar el puerto con la variable de entorno `PORT`:

```bash
PORT=8080 npm start
```

## Estructura

```
elementaria_online/
|- server.js        Servidor Node + Express + socket.io
|- package.json     Dependencias y script de arranque
|- public/
   |- index.html    El juego completo + la capa de red
```

## Nota de seguridad

El servidor no incluye autenticacion: pensado para jugar entre amigos en una
red de confianza o en local. Si quieres exponerlo a Internet, anade control de
acceso y validacion adicionales.
