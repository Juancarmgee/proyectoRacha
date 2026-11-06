import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCV4RllxwVrAoKC5dCEJF2Mwc-Y6Eben7E",
  authDomain: "diario-de-estudio-17d6b.firebaseapp.com",
  projectId: "diario-de-estudio-17d6b",
  storageBucket: "diario-de-estudio-17d6b.firebasestorage.app",
  messagingSenderId: "146775947297",
  appId: "1:146775947297:web:4d2ce57fa3b1af92dfcb60",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Solo se usa para migrar las sesiones que ya existían en localStorage.
const CLAVE_SESIONES_ANTIGUA = "diarioDeEstudio.sesiones";

const pantallaLogin = document.getElementById("pantalla-login");
const contenedorApp = document.getElementById("app");
const formularioLogin = document.getElementById("formulario-login");
const campoCorreo = document.getElementById("correo");
const campoContrasena = document.getElementById("contrasena");
const errorLogin = document.getElementById("error-login");
const botonLogin = document.getElementById("boton-login");
const botonSalir = document.getElementById("boton-salir");

const formulario = document.getElementById("formulario-sesion");
const campoFecha = document.getElementById("fecha");
const campoTema = document.getElementById("tema");
const campoInicio = document.getElementById("inicio");
const campoFin = document.getElementById("fin");
const duracionValor = document.getElementById("duracion-valor");
const mensajeError = document.getElementById("mensaje-error");
const botonGuardar = document.getElementById("boton-guardar");
const estadoSesiones = document.getElementById("estado-sesiones");
const errorSesiones = document.getElementById("error-sesiones");
const rachaNumero = document.getElementById("racha-numero");
const rachaTexto = document.getElementById("racha-texto");
const listaSesiones = document.getElementById("lista-sesiones");
const sinSesiones = document.getElementById("sin-sesiones");

let sesiones = [];
let usuarioActual = null;

// ---------- Fechas (siempre en hora local) ----------

function fechaLocalATexto(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function hoyTexto() {
  return fechaLocalATexto(new Date());
}

function sumarDias(textoFecha, cantidad) {
  const [anio, mes, dia] = textoFecha.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  fecha.setDate(fecha.getDate() + cantidad);
  return fechaLocalATexto(fecha);
}

function formatearFecha(textoFecha) {
  const [anio, mes, dia] = textoFecha.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);

  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(fecha);
}

// ---------- Duración de las sesiones ----------

function obtenerMinutos(sesion) {
  if (Number.isFinite(sesion.inicio) && Number.isFinite(sesion.fin)) {
    return sesion.fin - sesion.inicio;
  }

  return Number.isFinite(sesion.minutos) ? sesion.minutos : 0;
}

function formatearDuracion(minutos) {
  if (!Number.isFinite(minutos)) {
    return "—";
  }

  if (minutos < 60) {
    return `${minutos} min`;
  }

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

function actualizarDuracion() {
  const inicio = Number(campoInicio.value);
  const fin = Number(campoFin.value);

  if (
    campoInicio.value === "" ||
    campoFin.value === "" ||
    !Number.isFinite(inicio) ||
    !Number.isFinite(fin) ||
    inicio < 0 ||
    fin <= inicio
  ) {
    duracionValor.textContent = "—";
    return;
  }

  duracionValor.textContent = formatearDuracion(fin - inicio);
}

// ---------- Racha ----------

function calcularRacha() {
  const diasConSesion = new Set(sesiones.map((sesion) => sesion.fecha));

  let dia = hoyTexto();

  // Si hoy todavía no hay sesión, la racha puede seguir viva desde ayer.
  if (!diasConSesion.has(dia)) {
    dia = sumarDias(dia, -1);
  }

  let racha = 0;

  while (diasConSesion.has(dia)) {
    racha++;
    dia = sumarDias(dia, -1);
  }

  return racha;
}

// ---------- Dibujar en pantalla ----------

function renderizarRacha() {
  const racha = calcularRacha();
  rachaNumero.textContent = racha;
  rachaTexto.textContent = racha === 1 ? "día seguido" : "días seguidos";
}

function crearElementoSesion(sesion) {
  const elemento = document.createElement("li");
  elemento.className = "sesion";

  const detalles = document.createElement("div");

  const tema = document.createElement("p");
  tema.className = "sesion-tema";
  tema.textContent = sesion.tema;
  detalles.appendChild(tema);

  if (Number.isFinite(sesion.inicio) && Number.isFinite(sesion.fin)) {
    const rango = document.createElement("p");
    rango.className = "sesion-rango";
    rango.textContent = `Del minuto ${sesion.inicio} al ${sesion.fin}`;
    detalles.appendChild(rango);
  }

  const minutos = document.createElement("span");
  minutos.className = "sesion-minutos";
  minutos.textContent = formatearDuracion(obtenerMinutos(sesion));

  elemento.appendChild(detalles);
  elemento.appendChild(minutos);

  return elemento;
}

function renderizarSesiones() {
  const sesionesOrdenadas = [...sesiones].sort(compararSesiones);

  listaSesiones.innerHTML = "";

  if (sesionesOrdenadas.length === 0) {
    sinSesiones.hidden = false;
    return;
  }

  sinSesiones.hidden = true;

  // Agrupamos las sesiones por fecha para mostrar el total de cada día.
  const grupos = new Map();

  sesionesOrdenadas.forEach(function (sesion) {
    if (!grupos.has(sesion.fecha)) {
      grupos.set(sesion.fecha, []);
    }
    grupos.get(sesion.fecha).push(sesion);
  });

  grupos.forEach(function (sesionesDelDia, fecha) {
    const grupo = document.createElement("li");
    grupo.className = "grupo-dia";

    const cabecera = document.createElement("div");
    cabecera.className = "dia-cabecera";

    const fechaElemento = document.createElement("span");
    fechaElemento.className = "dia-fecha";
    fechaElemento.textContent = formatearFecha(fecha);

    const totalDelDia = sesionesDelDia.reduce(function (total, sesion) {
      return total + obtenerMinutos(sesion);
    }, 0);

    const totalElemento = document.createElement("span");
    totalElemento.className = "dia-total";
    totalElemento.textContent = "Total: " + formatearDuracion(totalDelDia);

    cabecera.appendChild(fechaElemento);
    cabecera.appendChild(totalElemento);

    const listaDelDia = document.createElement("ul");
    listaDelDia.className = "sesiones-dia";

    sesionesDelDia.forEach(function (sesion) {
      listaDelDia.appendChild(crearElementoSesion(sesion));
    });

    grupo.appendChild(cabecera);
    grupo.appendChild(listaDelDia);
    listaSesiones.appendChild(grupo);
  });
}

function renderizar() {
  renderizarRacha();
  renderizarSesiones();
}

// ---------- Firestore ----------

function referenciaSesiones(uid) {
  return collection(db, "usuarios", uid, "sesiones");
}

function claveSesion(sesion) {
  return JSON.stringify([
    sesion.fecha,
    sesion.tema,
    Number(sesion.inicio),
    Number(sesion.fin),
  ]);
}

function creadoEnMilisegundos(valor) {
  if (valor && typeof valor.toMillis === "function") {
    return valor.toMillis();
  }

  if (valor instanceof Date) {
    return valor.getTime();
  }

  return Number(valor) || 0;
}

function compararSesiones(a, b) {
  if (a.fecha !== b.fecha) {
    return a.fecha < b.fecha ? 1 : -1;
  }

  return creadoEnMilisegundos(b.creadoEn) - creadoEnMilisegundos(a.creadoEn);
}

async function obtenerSesiones(uid) {
  const snapshot = await getDocs(referenciaSesiones(uid));

  return snapshot.docs.map(function (documento) {
    return {
      id: documento.id,
      ...documento.data(),
    };
  });
}

function normalizarSesionAntigua(sesion) {
  if (!sesion || typeof sesion !== "object") {
    return null;
  }

  const fecha = typeof sesion.fecha === "string" ? sesion.fecha : "";
  const tema = typeof sesion.tema === "string" ? sesion.tema.trim() : "";

  const tieneInicio =
    sesion.inicio !== undefined && sesion.inicio !== null && sesion.inicio !== "";
  const inicio = tieneInicio ? Number(sesion.inicio) : 0;

  let fin =
    sesion.fin !== undefined && sesion.fin !== null && sesion.fin !== ""
      ? Number(sesion.fin)
      : NaN;

  if (!Number.isFinite(fin)) {
    const minutosGuardados = Number(sesion.minutos);

    if (Number.isFinite(minutosGuardados)) {
      fin = inicio + minutosGuardados;
    }
  }

  if (
    fecha === "" ||
    tema === "" ||
    !Number.isFinite(inicio) ||
    inicio < 0 ||
    !Number.isFinite(fin) ||
    fin <= inicio
  ) {
    return null;
  }

  const creadoEn = Number.isFinite(Number(sesion.creadoEn))
    ? new Date(Number(sesion.creadoEn))
    : null;

  return {
    fecha,
    tema,
    inicio,
    fin,
    minutos: fin - inicio,
    creadoEn,
  };
}

async function migrarSesionesAntiguas(uid, sesionesActuales) {
  let guardadas;

  try {
    guardadas = localStorage.getItem(CLAVE_SESIONES_ANTIGUA);
  } catch (error) {
    return 0;
  }

  if (!guardadas) {
    return 0;
  }

  let antiguas;

  try {
    antiguas = JSON.parse(guardadas);
  } catch (error) {
    return 0;
  }

  if (!Array.isArray(antiguas) || antiguas.length === 0) {
    try {
      localStorage.removeItem(CLAVE_SESIONES_ANTIGUA);
    } catch (error) {
      // Si el navegador bloquea localStorage, no hay nada que migrar.
    }
    return 0;
  }

  const clavesExistentes = new Set(sesionesActuales.map(claveSesion));
  let migradas = 0;
  let huboInvalidas = false;

  for (const sesion of antiguas) {
    const normalizada = normalizarSesionAntigua(sesion);

    if (!normalizada) {
      huboInvalidas = true;
      continue;
    }

    const clave = claveSesion(normalizada);

    if (clavesExistentes.has(clave)) {
      continue;
    }

    await addDoc(referenciaSesiones(uid), {
      fecha: normalizada.fecha,
      tema: normalizada.tema,
      inicio: normalizada.inicio,
      fin: normalizada.fin,
      minutos: normalizada.minutos,
      creadoEn: normalizada.creadoEn || serverTimestamp(),
    });

    clavesExistentes.add(clave);
    migradas++;
  }

  if (!huboInvalidas) {
    try {
      localStorage.removeItem(CLAVE_SESIONES_ANTIGUA);
    } catch (error) {
      // Si falla, las sesiones ya están en Firestore.
    }
  }

  return migradas;
}

function mostrarCargaSesiones() {
  sesiones = [];
  rachaNumero.textContent = "0";
  rachaTexto.textContent = "días seguidos";
  listaSesiones.innerHTML = "";
  listaSesiones.hidden = true;
  sinSesiones.hidden = true;
  errorSesiones.hidden = true;
  estadoSesiones.hidden = false;
}

function mostrarErrorSesiones(texto) {
  estadoSesiones.hidden = true;
  listaSesiones.hidden = true;
  sinSesiones.hidden = true;
  errorSesiones.textContent = texto;
  errorSesiones.hidden = false;
}

function mensajeErrorCarga(error) {
  if (error && error.code === "permission-denied") {
    return "No tienes permiso para ver las sesiones. Revisa las reglas de Firestore.";
  }

  if (error && error.code === "unavailable") {
    return "No hay conexión con la base de datos. Revisa tu internet.";
  }

  return "No se pudieron cargar las sesiones. Inténtalo de nuevo.";
}

function mensajeErrorGuardado(error) {
  if (error && error.code === "permission-denied") {
    return "No tienes permiso para guardar. Revisa las reglas de Firestore.";
  }

  if (error && error.code === "unavailable") {
    return "No hay conexión con la base de datos. Revisa tu internet.";
  }

  return "No se pudo guardar la sesión. Inténtalo de nuevo.";
}

async function cargarTodo(uid) {
  mostrarCargaSesiones();

  try {
    sesiones = await obtenerSesiones(uid);
    sesiones.sort(compararSesiones);

    try {
      const migradas = await migrarSesionesAntiguas(uid, sesiones);

      if (migradas > 0) {
        sesiones = await obtenerSesiones(uid);
        sesiones.sort(compararSesiones);
      }
    } catch (error) {
      console.error("No se pudieron migrar las sesiones antiguas:", error);
    }

    if (!usuarioActual || usuarioActual.uid !== uid) {
      return;
    }

    estadoSesiones.hidden = true;
    errorSesiones.hidden = true;
    listaSesiones.hidden = false;
    renderizar();
  } catch (error) {
    console.error("No se pudieron cargar las sesiones:", error);

    if (usuarioActual && usuarioActual.uid === uid) {
      mostrarErrorSesiones(mensajeErrorCarga(error));
    }
  }
}

// ---------- Formulario de sesiones ----------

function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}

formulario.addEventListener("submit", async function (evento) {
  evento.preventDefault();

  if (!usuarioActual) {
    mostrarError("La sesión ha caducado. Vuelve a iniciar sesión.");
    return;
  }

  const fecha = campoFecha.value;
  const tema = campoTema.value.trim();
  const inicioTexto = campoInicio.value;
  const finTexto = campoFin.value;
  const inicio = Number(inicioTexto);
  const fin = Number(finTexto);

  if (fecha === "") {
    mostrarError("Elige una fecha.");
    campoFecha.focus();
    return;
  }

  if (tema === "") {
    mostrarError("Escribe un tema.");
    campoTema.focus();
    return;
  }

  if (inicioTexto === "" || !Number.isFinite(inicio) || inicio < 0) {
    mostrarError("El minuto inicial debe ser 0 o mayor.");
    campoInicio.focus();
    return;
  }

  if (finTexto === "" || !Number.isFinite(fin)) {
    mostrarError("Escribe el minuto final.");
    campoFin.focus();
    return;
  }

  if (fin <= inicio) {
    mostrarError("El minuto final debe ser mayor que el inicial.");
    campoFin.focus();
    return;
  }

  botonGuardar.disabled = true;
  botonGuardar.textContent = "Guardando...";
  mensajeError.hidden = true;

  try {
    await addDoc(referenciaSesiones(usuarioActual.uid), {
      fecha: fecha,
      tema: tema,
      inicio: inicio,
      fin: fin,
      minutos: fin - inicio,
      creadoEn: serverTimestamp(),
    });

    sesiones.push({
      fecha: fecha,
      tema: tema,
      inicio: inicio,
      fin: fin,
      minutos: fin - inicio,
      creadoEn: new Date(),
    });
    sesiones.sort(compararSesiones);

    estadoSesiones.hidden = true;
    errorSesiones.hidden = true;
    listaSesiones.hidden = false;
    renderizar();

    // Dejamos el formulario listo para la siguiente sesión.
    formulario.reset();
    campoFecha.value = hoyTexto();
    actualizarDuracion();
  } catch (error) {
    console.error("No se pudo guardar la sesión:", error);
    mostrarError(mensajeErrorGuardado(error));
  } finally {
    botonGuardar.disabled = false;
    botonGuardar.textContent = "Guardar sesión";
  }
});

formulario.addEventListener("input", function () {
  mensajeError.hidden = true;
  actualizarDuracion();
});

// ---------- Inicio de sesión ----------

function mensajeErrorLogin(error) {
  if (error && error.code === "auth/too-many-requests") {
    return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  }

  if (error && error.code === "auth/network-request-failed") {
    return "No hay conexión. Revisa tu internet.";
  }

  return "Correo o contraseña incorrectos.";
}

formularioLogin.addEventListener("submit", async function (evento) {
  evento.preventDefault();

  const correo = campoCorreo.value.trim();
  const contrasena = campoContrasena.value;

  if (correo === "" || contrasena === "") {
    errorLogin.textContent = "Escribe tu correo y tu contraseña.";
    errorLogin.hidden = false;
    return;
  }

  botonLogin.disabled = true;
  botonLogin.textContent = "Entrando...";
  errorLogin.hidden = true;

  try {
    await signInWithEmailAndPassword(auth, correo, contrasena);
  } catch (error) {
    errorLogin.textContent = mensajeErrorLogin(error);
    errorLogin.hidden = false;
  } finally {
    botonLogin.disabled = false;
    botonLogin.textContent = "Entrar";
  }
});

formularioLogin.addEventListener("input", function () {
  errorLogin.hidden = true;
});

botonSalir.addEventListener("click", async function () {
  botonSalir.disabled = true;

  try {
    await signOut(auth);
  } catch (error) {
    console.error("No se pudo cerrar sesión:", error);
  } finally {
    botonSalir.disabled = false;
  }
});

onAuthStateChanged(auth, function (usuario) {
  usuarioActual = usuario;

  if (!usuario) {
    sesiones = [];
    errorLogin.hidden = true;
    campoContrasena.value = "";
    pantallaLogin.hidden = false;
    contenedorApp.hidden = true;
    return;
  }

  formularioLogin.reset();
  errorLogin.hidden = true;
  pantallaLogin.hidden = true;
  contenedorApp.hidden = false;
  cargarTodo(usuario.uid);
});

// ---------- Arranque ----------

campoFecha.value = hoyTexto();
actualizarDuracion();
