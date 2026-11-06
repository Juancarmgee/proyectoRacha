// Clave con la que guardamos las sesiones en localStorage.
const CLAVE_SESIONES = "diarioDeEstudio.sesiones";

const formulario = document.getElementById("formulario-sesion");
const campoFecha = document.getElementById("fecha");
const campoTema = document.getElementById("tema");
const campoInicio = document.getElementById("inicio");
const campoFin = document.getElementById("fin");
const duracionValor = document.getElementById("duracion-valor");
const mensajeError = document.getElementById("mensaje-error");
const rachaNumero = document.getElementById("racha-numero");
const rachaTexto = document.getElementById("racha-texto");
const listaSesiones = document.getElementById("lista-sesiones");
const sinSesiones = document.getElementById("sin-sesiones");

let sesiones = [];

// ---------- Guardado en localStorage ----------

function cargarSesiones() {
  try {
    const datosGuardados = localStorage.getItem(CLAVE_SESIONES);

    if (!datosGuardados) {
      return [];
    }

    const datos = JSON.parse(datosGuardados);
    return Array.isArray(datos) ? datos : [];
  } catch (error) {
    return [];
  }
}

function guardarSesiones() {
  try {
    localStorage.setItem(CLAVE_SESIONES, JSON.stringify(sesiones));
  } catch (error) {
    // Si el navegador bloquea localStorage, la app sigue funcionando en memoria.
  }
}

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
  const sesionesOrdenadas = [...sesiones].sort(function (a, b) {
    if (a.fecha !== b.fecha) {
      return a.fecha < b.fecha ? 1 : -1;
    }
    return (b.creadoEn || 0) - (a.creadoEn || 0);
  });

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

// ---------- Formulario ----------

function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}

formulario.addEventListener("submit", function (evento) {
  evento.preventDefault();

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

  sesiones.push({
    fecha: fecha,
    tema: tema,
    inicio: inicio,
    fin: fin,
    minutos: fin - inicio,
    creadoEn: Date.now(),
  });

  guardarSesiones();
  renderizar();

  // Dejamos el formulario listo para la siguiente sesión.
  formulario.reset();
  campoFecha.value = hoyTexto();
  actualizarDuracion();
  mensajeError.hidden = true;
});

formulario.addEventListener("input", function () {
  mensajeError.hidden = true;
  actualizarDuracion();
});

// ---------- Arranque ----------

sesiones = cargarSesiones();
campoFecha.value = hoyTexto();
renderizar();
actualizarDuracion();
