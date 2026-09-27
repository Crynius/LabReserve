/*const estado = document.getElementById("alerta");
const boton = document.getElementById("btnRegistrar");
const inputCodigo = document.getElementById("codigoAcceso");
boton.addEventListener("click",() => {
const codigo = inputCodigo.value;

if (codigo !==""){
 estado.textContent = "acceso concedido al codigo " + codigo;
 estado.classList.add ("exito");
 estado.classList.remove ("error");
}else{
estado.textContent = "Error: campo obligatorio ";
 estado.classList.remove ("exito");
 estado.classList.add ("error");
}

inputCodigo.value = "";
inputCodigo.focus();

});
*/
const estado = document.getElementById("mensajeMatricula");
const boton = document.getElementById("btnRegistrarPlaca");
const inputPlaca = document.getElementById("placaVehiculo");

boton.addEventListener("click", () => {
    const placa = inputPlaca.value;
if(placa !=="") {
estado.textContent = "placa registrada " + placa;
estado.classList.add("exito");
estado.classList.remove("error");
}else{
estado.textContent = "error: ingrese una placa " 
estado.classList.remove("exito");
estado.classList.add("error");
}

inputPlaca.value = "";
inputPlaca.focus();
});
