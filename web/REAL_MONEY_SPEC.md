# Especificación: Dinero real (USDC)

Documento de referencia para la implementación de depósitos, retiros y balance con USDC real. Todo lo que sigue queda fijado como requisito hasta que se acuerde un cambio explícito.

---

## 1. Moneda y red

| Aspecto | Decisión |
|--------|----------|
| **Moneda** | Única: **USDC** (USD Coin). No se soportan otros tokens en esta fase. |
| **Redes** | El usuario **elige la red** para depositar y para retirar. Soporte inicial recomendado: **Polygon** y **Base**. Se puede ampliar a más redes más adelante (misma lógica, nuevo contrato + indexación). |
| **Balance unificado** | Un solo balance por usuario. No hay "balance en Polygon" y "balance en Base" por separado: todo suma/resta del mismo balance en DB. El usuario deposita en la red que quiera y retira en la red que quiera. |

---

## 2. Presentación en la app: siempre en dólares ($)

| Regla | Detalle |
|-------|---------|
| **Balance** | Siempre mostrado en **$** (dólares), nunca el texto "USDC" como moneda visible. Ejemplo: `$10.50`, no `10.50 USDC`. |
| **Stakes, ganancias, depósitos, retiros** | Todas las cantidades monetarias en la UI en **$**. Ejemplos: "Stake: $5", "You won +$9.50", "Deposit $20", "Withdraw $15". |
| **Internamente** | En base de datos y APIs se puede seguir usando centavos (enteros) para precisión; la conversión a dólares es solo de presentación (dividir por 100 y formatear como `$X.XX`). |
| **Excepciones** | En flujos de depósito/retiro on-chain (instrucciones, direcciones, "envía USDC en Polygon") sí se puede mencionar "USDC" y el nombre de la red cuando sea necesario para que el usuario sepa qué red y qué token usar. |

---

## 3. Modelo de custodia

- **Custodial:** el usuario envía USDC a la plataforma (contrato o dirección controlada por la plataforma). La plataforma mantiene el balance en su base de datos y es responsable de tener liquidez para pagar retiros.
- El dinero no permanece en la wallet del usuario durante el uso de la app: una vez depositado, el balance es un saldo interno (en DB) hasta que el usuario pide un retiro.

---

## 4. Depósitos

### 4.1 Atribución del depósito al usuario

- **Enfoque:** Una **wallet/contrato de plataforma por red** + **referencia de usuario en el contrato**.
- No se usa "una dirección por usuario" (demasiada complejidad operativa).
- No se depende de memo en la transferencia (no fiable en todas las redes).

### 4.2 Mecánica técnica

- En **cada red** soportada (Polygon, Base, …) se despliega un **contrato de depósito** (misma lógica en todas).
- El contrato expone una función del tipo **`depositFor(userId, amount)`** (o equivalente que reciba identificador de usuario y monto).
- Flujo usuario:
  1. En la app elige red (ej. Polygon).
  2. Conecta wallet o ve instrucciones para enviar USDC.
  3. Aprueba (approve) USDC al contrato y llama `depositFor(miUserId, cantidad)`.
- El contrato:
  - Recibe/transfiere el USDC a la treasury de la plataforma (o lo mantiene en contrato según diseño).
  - Emite un **evento** tipo `Deposit(userId, amount, timestamp)` (o equivalente).
- **Backend:**
  - Indexa/escucha eventos de depósito en **cada** red.
  - Cuando detecta `Deposit(userId, amount)` en cualquier red, **acredita** ese `amount` al `userId` en el balance unificado (en DB).
- El balance en la app es único; no importa desde qué red llegó el depósito.

### 4.3 Redes iniciales

- Implementar primero en **Polygon** y **Base** (o solo una si se prioriza lanzar rápido).
- Añadir más redes después replicando contrato + indexación + liquidez.

---

## 5. Retiros

- El usuario indica **monto** y **red** de retiro (ej. "Retirar $50 en Polygon").
- Opcional: guardar una **dirección de retiro por red** en su perfil para no pedirla cada vez.
- Backend:
  - Comprueba que el balance unificado (en DB) sea ≥ monto.
  - Resta el monto del balance.
  - Envía **USDC en la red elegida** desde la **wallet de la plataforma en esa red** a la dirección del usuario.
- La plataforma debe tener **liquidez (USDC) en cada red** que ofrezca para retiros. Los depósitos en esa red reponen liquidez; si hace falta, la plataforma debe bridge o recomprar en esa red.

---

## 6. Partidas y stakes (sin cambio de lógica de negocio)

- Las partidas siguen usando el **balance en DB** (stake, ganancia, reembolso en tablas).
- No cambia la lógica de: crear partida, descontar stake, pagar al ganador, ofrecer tablas, etc.
- Solo cambia el **origen** del balance: en lugar de "simulado", el balance se alimenta por depósitos USDC reales y se reduce por retiros reales.

---

## 7. Resumen de reglas fijadas

1. **Moneda:** USDC únicamente.
2. **Red:** el usuario elige red para depósito y para retiro (múltiples redes soportadas).
3. **Balance:** uno solo por usuario; se muestra siempre en **$**, nunca "USDC" como etiqueta principal en la UI.
4. **Depósito:** contrato por red con `depositFor(userId, amount)`; backend indexa eventos y acredita al balance unificado.
5. **Retiro:** usuario elige red; plataforma envía USDC desde su wallet en esa red; se deduce del mismo balance unificado.
6. **Custodial:** el dinero depositado está bajo control de la plataforma hasta el retiro.

---

## 8. Seguridad, fiabilidad y flexibilidad

### 8.1 Seguridad

- **Atribución on-chain:** El contrato `depositFor(userId, amount)` deja en blockchain quién depositó y cuánto; el backend solo lee eventos. No hay ambigüedad.
- **Custodial:** La plataforma custodia fondos. Para que el sistema sea seguro se exige:
  - **Gestión de claves:** Hot wallet con límites para retiros frecuentes; el resto en cold o multisig. No concentrar todo en una sola clave.
  - **Procesamiento idempotente de depósitos:** Cada evento/tx de depósito debe acreditarse **como máximo una vez**. Usar un id único (ej. `chainId + txHash + logIndex`) y persistirlo; si el mismo id se procesa de nuevo, no volver a acreditar.
  - **Límites y controles en retiros:** Límites por operación y/o por ventana de tiempo; para montos grandes, retraso o revisión manual si se define así.
- El diseño (contrato por red, balance unificado en DB) es adecuado; la seguridad depende de la custodia de claves y de aplicar idempotencia y límites en la implementación.

### 8.2 Fiabilidad

- **Varias redes:** Cada red tiene su indexador o listener de eventos. Si uno falla, solo se retrasan depósitos en esa red; el resto sigue. Con reintentos e **idempotencia** se puede recuperar sin duplicar acreditaciones.
- **Un solo balance:** Evita estados inconsistentes entre redes.
- **Retiros:** Si una transacción de retiro falla (gas, nonce, RPC), debe existir una política clara: reintento automático y/o reacreditar el monto al usuario y notificar. No dejar el balance debitado sin que el usuario haya recibido los fondos.
- **Requisitos de implementación:** Idempotencia en el procesamiento de depósitos; manejo explícito de fallos en retiros (reintento o reacreditación); monitoreo por red (eventos procesados, retiros pendientes/fallidos).

### 8.3 Escalabilidad

- Más usuarios implica más eventos de depósito y más retiros. El contrato no mantiene estado por usuario; el backend solo procesa más eventos y más filas en ledger. La liquidez por red es operativa (reponer fondos cuando haga falta). El diseño escala sin cambios estructurales.

### 8.4 Flexibilidad: más redes

- Añadir una red nueva = desplegar el **mismo** contrato en esa cadena, añadir indexación para esa red, una wallet de treasury en esa red y la opción en la UI. Misma lógica, mismo balance unificado.
- Se debe mantener **configuración** (DB o env) con “redes soportadas” y dirección del contrato por red, para no hardcodear y poder activar/desactivar redes sin tocar código de negocio.

### 8.5 Flexibilidad: más monedas (futuro)

- El diseño actual es **una sola moneda (USDC)** y un solo balance en $. No bloquea añadir más monedas después, pero tampoco está preparado de fábrica.
- Para soportar **varias monedas** (ej. USDT, EURC) haría falta: balance por moneda (schema: ej. tabla `user_balance(user_id, currency, balance)`), reglas de uso (con qué moneda se apuesta, conversión o no), contrato/indexación/treasury por (red, moneda). Es una **extensión** del modelo, no un simple flag.
- Queda fijado: el setup actual es el indicado para **una moneda, muchas redes**; la extensión a más monedas es posible pero requiere ampliar modelo de datos, contratos y lógica cuando se decida.

---

## 9. Próximos pasos de implementación (referencia)

1. Actualizar toda la UI de balance y cantidades para mostrar **$** y no "USDC" (salvo en pasos explícitos de depósito/retiro on-chain).
2. Definir modelo de datos si hace falta (ej. tabla de direcciones de retiro por usuario y red).
3. Desarrollar y desplegar contrato de depósito (Polygon primero, luego Base).
4. Backend: indexación de eventos de depósito por red y acreditación al balance.
5. Backend: flujo de retiro (validación, envío on-chain por red elegida).
6. UI: flujo de depósito (elegir red, conectar wallet, approve + depositFor).
7. UI: flujo de retiro (elegir red, monto, dirección).
8. Operación: treasury y liquidez por red; monitoreo y alertas.

---

## 10. Variables de entorno (setup USDC)

Nombres de variables a usar en `.env`. No subir `.env` a Git.

| Variable | Uso | Ejemplo / nota |
|----------|-----|------------------|
| `POLYGON_RPC_URL` | RPC para leer/escribir en Polygon | `https://polygon-mainnet.g.alchemy.com/v2/...` |
| `BASE_RPC_URL` | RPC para Base (cuando se habilite) | `https://base-mainnet.g.alchemy.com/v2/...` |
| `TREASURY_ADDRESS` | Dirección de la wallet de la plataforma (recibe USDC del contrato) | `0x...` |
| `TREASURY_PRIVATE_KEY` | Clave privada de esa wallet (para enviar retiros desde el backend) | Sin el prefijo `0x` o con él, según la lib. **Nunca commitear.** |
| `POLYGON_DEPOSIT_CONTRACT_ADDRESS` | Dirección del contrato de depósito en Polygon | Rellenar tras desplegar; vacío hasta entonces. |
| `BASE_DEPOSIT_CONTRACT_ADDRESS` | Dirección del contrato de depósito en Base | Rellenar tras desplegar; vacío hasta entonces. |
| `POLYGON_USDC_ADDRESS` | Dirección del contrato USDC en Polygon | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` (USDC nativo Polygon) |
| `BASE_USDC_ADDRESS` | Dirección del contrato USDC en Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

Misma wallet (misma dirección y clave) puede usarse en Polygon y Base; no hace falta una clave por red.

---

*Documento creado para fijar decisiones antes de implementar. Revisar y actualizar este archivo si se cambia alguna decisión.*
