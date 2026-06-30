from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import bcrypt
import jwt
import openpyxl
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== DB ==============
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change")

app = FastAPI(title="FS Soluções - Preditiva")
api = APIRouter(prefix="/api")

# ============== Helpers ==============

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_token(user_id: str, email: str, ttl_min: int = 60 * 24 * 7) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ttl_min),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return user

def require_editor(user=Depends(get_current_user)) -> dict:
    if user.get("role") == "visualizador":
        raise HTTPException(status_code=403, detail="Permissão negada: usuário somente leitura")
    return user

# ============== Models ==============
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "tecnico"  # admin, tecnico, gestor, visualizador

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str

class PlantNode(BaseModel):
    id: Optional[str] = None
    name: str
    type: str  # empresa, unidade, area, equipamento, subconjunto, ponto
    parent_id: Optional[str] = None

class MachineModel(BaseModel):
    id: Optional[str] = None
    tag: str
    local: Optional[str] = ""
    equipamento: Optional[str] = ""
    descricao: Optional[str] = ""
    fabricante: Optional[str] = ""
    rpm: Optional[float] = None
    potencia: Optional[float] = None
    rolamento_loa: Optional[str] = ""
    rolamento_la: Optional[str] = ""
    criticidade: Optional[str] = "Média"  # Alta, Média, Baixa
    status: Optional[str] = "OK"  # OK, A1, A2, Parado
    tipo: Optional[str] = "vibracao"  # vibracao, termografia, ambos
    componente: Optional[str] = ""

class DefectModel(BaseModel):
    id: Optional[str] = None
    nome: str
    categoria: Optional[str] = ""  # mecanico, eletrico, rolamento, lubrificacao
    sintomas: Optional[str] = ""
    frequencias: Optional[str] = ""
    causas: Optional[str] = ""
    consequencias: Optional[str] = ""
    acoes: Optional[str] = ""
    diagnostico: Optional[str] = ""
    recomendacao: Optional[str] = ""
    alarme: Optional[str] = "A1"  # OK, A1, A2, Parado
    ativo: bool = True

class DiagnosticoModel(BaseModel):
    id: Optional[str] = None
    machine_id: str
    machine_tag: Optional[str] = ""
    defect_ids: List[str] = []
    diagnostico: str = ""
    causa: str = ""
    consequencia: str = ""
    recomendacao: str = ""
    status: str = "A1"  # define new machine status
    tecnico: Optional[str] = ""
    data: Optional[str] = None

class MeasurementModel(BaseModel):
    id: Optional[str] = None
    machine_id: str
    machine_tag: Optional[str] = ""
    subconjunto: str
    ponto: str
    valor: float
    unidade: str
    deteccao: str
    data: Optional[str] = None

# ============== Seeds ==============
DEFAULT_DEFECTS = [
    {"nome": "Desbalanceamento", "categoria": "mecanico", "sintomas": "Vibração predominante em 1xRPM, principalmente radial", "frequencias": "1xRPM (radial)", "causas": "Massa desigual no rotor, depósitos, parafusos perdidos", "consequencias": "Fadiga em rolamentos, trincas em estruturas, perda de eficiência", "acoes": "Balanceamento em campo, inspeção de rotor", "diagnostico": "Desbalanceamento de rotor confirmado por componente em 1xRPM", "recomendacao": "Programar balanceamento dinâmico no próximo PM", "alarme": "A1"},
    {"nome": "Desalinhamento", "categoria": "mecanico", "sintomas": "Vibração em 2xRPM axial elevada, vibração radial assimétrica", "frequencias": "1x, 2x e 3xRPM (axial e radial)", "causas": "Acoplamento mal alinhado, base deformada, dilatação térmica", "consequencias": "Desgaste prematuro de acoplamento e rolamentos", "acoes": "Realinhamento a laser", "diagnostico": "Desalinhamento entre motor e equipamento acionado", "recomendacao": "Executar alinhamento a laser e reavaliar em 30 dias", "alarme": "A1"},
    {"nome": "Rolamento - BPFO (Pista Externa)", "categoria": "rolamento", "sintomas": "Picos na frequência BPFO no envelope, modulações", "frequencias": "BPFO e harmônicas", "causas": "Falha por fadiga, contaminação, lubrificação inadequada", "consequencias": "Falha catastrófica do rolamento", "acoes": "Substituição do rolamento, revisar lubrificação", "diagnostico": "Defeito em pista externa do rolamento (BPFO)", "recomendacao": "Programar troca de rolamento dentro de 30-60 dias", "alarme": "A2"},
    {"nome": "Rolamento - BPFI (Pista Interna)", "categoria": "rolamento", "sintomas": "Picos em BPFI no envelope, bandas laterais em 1xRPM", "frequencias": "BPFI ± 1xRPM", "causas": "Fadiga, montagem inadequada, sobrecarga", "consequencias": "Falha do rolamento em curto prazo", "acoes": "Substituição imediata do rolamento", "diagnostico": "Defeito em pista interna do rolamento (BPFI)", "recomendacao": "Substituir rolamento na próxima parada programada", "alarme": "A2"},
    {"nome": "Rolamento - BSF (Esfera/Rolo)", "categoria": "rolamento", "sintomas": "Picos em BSF, modulação por FTF", "frequencias": "BSF ± FTF", "causas": "Defeito em elementos rolantes", "consequencias": "Ruído crescente, falha a curto/médio prazo", "acoes": "Substituição do rolamento", "diagnostico": "Defeito em elemento rolante (BSF)", "recomendacao": "Substituir rolamento", "alarme": "A2"},
    {"nome": "Folga Mecânica", "categoria": "mecanico", "sintomas": "Múltiplas harmônicas de 1xRPM (0.5x, 1x, 1.5x, 2x...)", "frequencias": "Harmônicas e sub-harmônicas de 1xRPM", "causas": "Fixação solta, desgaste em mancais", "consequencias": "Aumento de vibração geral, falhas em série", "acoes": "Verificar fixação, parafusos e mancais", "diagnostico": "Folga mecânica em base/mancal", "recomendacao": "Inspecionar e reapertar fixações", "alarme": "A1"},
    {"nome": "Cavitação", "categoria": "hidraulico", "sintomas": "Vibração aleatória em alta frequência, ruído característico", "frequencias": "Banda larga em alta frequência", "causas": "NPSH insuficiente, restrição na sucção", "consequencias": "Erosão de impulsor, perda de performance", "acoes": "Revisar sucção, NPSH, filtros", "diagnostico": "Cavitação em bomba", "recomendacao": "Verificar condições de sucção da bomba", "alarme": "A1"},
    {"nome": "Barra Quebrada (Motor)", "categoria": "eletrico", "sintomas": "Bandas laterais em ±2sLs em torno de 1xRPM", "frequencias": "1xRPM ± 2sLs", "causas": "Fadiga em barras do rotor, alta carga", "consequencias": "Perda de torque, falha do motor", "acoes": "Análise elétrica, rebobinamento", "diagnostico": "Barras quebradas no rotor do motor", "recomendacao": "Programar revisão elétrica do motor", "alarme": "A2"},
    {"nome": "Engrenagem - GMF", "categoria": "mecanico", "sintomas": "Picos em GMF e harmônicas, bandas laterais", "frequencias": "GMF ± Frequência do eixo", "causas": "Desgaste de dentes, dentes quebrados", "consequencias": "Falha de redutor", "acoes": "Inspecionar redutor", "diagnostico": "Defeito em engrenamento", "recomendacao": "Programar inspeção do redutor", "alarme": "A1"},
    {"nome": "Lubrificação Inadequada", "categoria": "lubrificacao", "sintomas": "Aumento gradual em alta frequência, envelope elevado", "frequencias": "Banda larga em alta frequência", "causas": "Falta ou excesso de graxa, contaminação", "consequencias": "Aceleração de falha em rolamentos", "acoes": "Relubrificar conforme plano", "diagnostico": "Lubrificação deficiente", "recomendacao": "Aplicar plano de lubrificação", "alarme": "A1"},
    {"nome": "Aquecimento Excessivo (Termografia)", "categoria": "termografia", "sintomas": "Temperatura acima do esperado em mancal/conexão", "frequencias": "—", "causas": "Sobrecarga, mau contato, lubrificação", "consequencias": "Falha do componente", "acoes": "Inspeção termográfica, ajustes", "diagnostico": "Ponto quente identificado", "recomendacao": "Inspecionar conexão/mancal", "alarme": "A1"},
]

async def seed_data():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.machines.create_index("tag", unique=True)
    await db.defects.create_index("nome", unique=True)
    await db.plant_nodes.create_index([("type", 1), ("parent_id", 1)])

    # Admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@fssolucoes.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Administrador",
            "role": "admin",
            "created_at": now_iso(),
        })
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Defects
    for d in DEFAULT_DEFECTS:
        await db.defects.update_one(
            {"nome": d["nome"]},
            {"$setOnInsert": {**d, "id": str(uuid.uuid4()), "ativo": True, "created_at": now_iso()}},
            upsert=True,
        )

    # Empresa
    empresa = await db.plant_nodes.find_one({"type": "empresa"})
    if not empresa:
        await db.plant_nodes.insert_one({
            "id": str(uuid.uuid4()),
            "name": "FS Soluções",
            "type": "empresa",
            "parent_id": None,
            "created_at": now_iso(),
        })


@app.on_event("startup")
async def startup():
    await seed_data()
    logger.info("FS Soluções - Preditiva inicializado")

# ============== Auth Routes ==============
@api.post("/auth/register")
async def register(payload: UserCreate, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": payload.role,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = create_token(user["id"], email)
    response.set_cookie("access_token", token, httponly=True, secure=False, samesite="lax", max_age=60 * 60 * 24 * 7, path="/")
    return {"id": user["id"], "email": email, "name": user["name"], "role": user["role"], "token": token}

@api.post("/auth/login")
async def login(payload: UserLogin, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    token = create_token(user["id"], email)
    response.set_cookie("access_token", token, httponly=True, secure=False, samesite="lax", max_age=60 * 60 * 24 * 7, path="/")
    return {"id": user["id"], "email": email, "name": user["name"], "role": user["role"], "token": token}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

@api.get("/users")
async def list_users(user=Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users

# ============== Plant Hierarchy ==============
@api.get("/plants")
async def list_plants(user=Depends(get_current_user)):
    nodes = await db.plant_nodes.find({}, {"_id": 0}).to_list(5000)
    return nodes

@api.post("/plants")
async def create_plant(payload: PlantNode, user=Depends(require_editor)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    await db.plant_nodes.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/plants/{node_id}")
async def update_plant(node_id: str, payload: PlantNode, user=Depends(require_editor)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None and k != "id"}
    res = await db.plant_nodes.update_one({"id": node_id}, {"$set": update})
    if not res.matched_count:
        raise HTTPException(404, "Nó não encontrado")
    return {"ok": True}

@api.delete("/plants/{node_id}")
async def delete_plant(node_id: str, user=Depends(require_editor)):
    await db.plant_nodes.delete_one({"id": node_id})
    return {"ok": True}

# ============== Machines ==============
@api.get("/machines")
async def list_machines(q: Optional[str] = None, tipo: Optional[str] = None, status: Optional[str] = None, user=Depends(get_current_user)):
    qry: Dict[str, Any] = {}
    if q:
        qry["$or"] = [
            {"tag": {"$regex": q, "$options": "i"}},
            {"equipamento": {"$regex": q, "$options": "i"}},
            {"local": {"$regex": q, "$options": "i"}},
            {"descricao": {"$regex": q, "$options": "i"}},
        ]
    if tipo and tipo != "todos":
        qry["tipo"] = {"$in": [tipo, "ambos"]}
    if status:
        qry["status"] = status
    items = await db.machines.find(qry, {"_id": 0}).to_list(5000)
    return items

@api.post("/machines")
async def create_machine(payload: MachineModel, user=Depends(require_editor)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    if await db.machines.find_one({"tag": doc["tag"]}):
        raise HTTPException(400, "TAG já cadastrada")
    await db.machines.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/machines/{machine_id}")
async def update_machine(machine_id: str, payload: MachineModel, user=Depends(require_editor)):
    update = {k: v for k, v in payload.model_dump().items() if k != "id"}
    res = await db.machines.update_one({"id": machine_id}, {"$set": update})
    if not res.matched_count:
        raise HTTPException(404, "Máquina não encontrada")
    return {"ok": True}

@api.delete("/machines/{machine_id}")
async def delete_machine(machine_id: str, user=Depends(require_editor)):
    await db.machines.delete_one({"id": machine_id})
    await db.measurements.delete_many({"machine_id": machine_id})
    return {"ok": True}

@api.post("/machines/import")
async def import_machines(file: UploadFile = File(...), user=Depends(require_editor)):
    content = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    inserted = 0
    skipped = 0
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        tipo = "vibracao" if "VIBRA" in sheet_name.upper() else ("termografia" if "TERMO" in sheet_name.upper() else "ambos")
        header_row = None
        header_idx = {}
        for row in ws.iter_rows(values_only=True):
            if header_row is None:
                vals = [str(c).strip().upper() if c else "" for c in row]
                if "TAG" in vals:
                    header_row = row
                    for i, v in enumerate(vals):
                        header_idx[v] = i
                continue
            tag_idx = header_idx.get("TAG")
            if tag_idx is None:
                continue
            tag = row[tag_idx]
            if not tag or not str(tag).strip():
                continue
            tag = str(tag).strip()
            # Skip section headers (e.g., "INDUSTRIA", "Subestação" - rows where only TAG present)
            local = row[header_idx.get("LOCAL DE INSTALAÇÃO", -1)] if header_idx.get("LOCAL DE INSTALAÇÃO", -1) >= 0 else None
            if not local:
                continue
            try:
                doc = {
                    "id": str(uuid.uuid4()),
                    "tag": tag,
                    "local": str(local or "").strip(),
                    "equipamento": str(row[header_idx.get("EQUIPAMENTOS", -1)] or "").strip() if header_idx.get("EQUIPAMENTOS", -1) >= 0 else "",
                    "descricao": str(row[header_idx.get("DESCRIÇÃO", -1)] or "").strip() if header_idx.get("DESCRIÇÃO", -1) >= 0 else "",
                    "rpm": float(row[header_idx.get("ROTAÇÃO", -1)]) if header_idx.get("ROTAÇÃO", -1) >= 0 and row[header_idx["ROTAÇÃO"]] else None,
                    "potencia": float(row[header_idx.get("POTENCIA", -1)]) if header_idx.get("POTENCIA", -1) >= 0 and row[header_idx["POTENCIA"]] else None,
                    "rolamento_loa": str(row[header_idx.get("ROLAMENTO LOA", -1)] or "").strip() if header_idx.get("ROLAMENTO LOA", -1) >= 0 else "",
                    "rolamento_la": str(row[header_idx.get("ROLAMENTO LA", -1)] or "").strip() if header_idx.get("ROLAMENTO LA", -1) >= 0 else "",
                    "componente": str(row[header_idx.get("COMPONENTE", -1)] or "").strip() if header_idx.get("COMPONENTE", -1) >= 0 else "",
                    "tipo": tipo,
                    "fabricante": "",
                    "criticidade": "Média",
                    "status": "OK",
                    "created_at": now_iso(),
                }
                exists = await db.machines.find_one({"tag": tag})
                if exists:
                    skipped += 1
                else:
                    await db.machines.insert_one(doc)
                    inserted += 1
            except Exception as ex:
                logger.warning("Skip row: %s", ex)
                skipped += 1
    return {"inserted": inserted, "skipped": skipped}

# ============== Defects ==============
@api.get("/defects")
async def list_defects(user=Depends(get_current_user)):
    items = await db.defects.find({}, {"_id": 0}).to_list(2000)
    return items

@api.post("/defects")
async def create_defect(payload: DefectModel, user=Depends(require_editor)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    await db.defects.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/defects/{defect_id}")
async def update_defect(defect_id: str, payload: DefectModel, user=Depends(require_editor)):
    update = {k: v for k, v in payload.model_dump().items() if k != "id"}
    res = await db.defects.update_one({"id": defect_id}, {"$set": update})
    if not res.matched_count:
        raise HTTPException(404, "Defeito não encontrado")
    return {"ok": True}

@api.delete("/defects/{defect_id}")
async def delete_defect(defect_id: str, user=Depends(require_editor)):
    await db.defects.delete_one({"id": defect_id})
    return {"ok": True}

# ============== Diagnostics ==============
@api.get("/diagnostics")
async def list_diagnostics(q: Optional[str] = None, user=Depends(get_current_user)):
    qry: Dict[str, Any] = {}
    if q:
        qry["$or"] = [
            {"machine_tag": {"$regex": q, "$options": "i"}},
            {"diagnostico": {"$regex": q, "$options": "i"}},
            {"recomendacao": {"$regex": q, "$options": "i"}},
        ]
    items = await db.diagnostics.find(qry, {"_id": 0}).sort("data", -1).to_list(2000)
    return items

@api.post("/diagnostics")
async def create_diagnostic(payload: DiagnosticoModel, user=Depends(require_editor)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["data"] = now_iso()
    doc["tecnico"] = doc.get("tecnico") or user.get("name", "")
    await db.diagnostics.insert_one(doc)
    # update machine status
    await db.machines.update_one({"id": doc["machine_id"]}, {"$set": {"status": doc["status"]}})
    doc.pop("_id", None)
    return doc

@api.put("/diagnostics/{diag_id}")
async def update_diagnostic(diag_id: str, payload: DiagnosticoModel, user=Depends(require_editor)):
    update = {k: v for k, v in payload.model_dump().items() if k not in ("id",)}
    res = await db.diagnostics.update_one({"id": diag_id}, {"$set": update})
    if not res.matched_count:
        raise HTTPException(404, "Diagnóstico não encontrado")
    await db.machines.update_one({"id": update.get("machine_id")}, {"$set": {"status": update.get("status")}})
    return {"ok": True}

@api.delete("/diagnostics/{diag_id}")
async def delete_diagnostic(diag_id: str, user=Depends(require_editor)):
    await db.diagnostics.delete_one({"id": diag_id})
    return {"ok": True}

# ============== Measurements (Vibração) ==============
@api.get("/measurements")
async def list_measurements(machine_id: Optional[str] = None, user=Depends(get_current_user)):
    qry: Dict[str, Any] = {}
    if machine_id:
        qry["machine_id"] = machine_id
    items = await db.measurements.find(qry, {"_id": 0}).sort("data", 1).to_list(5000)
    return items

@api.post("/measurements/import")
async def import_measurements(machine_id: Optional[str] = Query(None), file: UploadFile = File(...), user=Depends(require_editor)):
    content = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb[wb.sheetnames[0]]
    inserted = 0
    header_idx = {}
    headers_found = False
    for row in ws.iter_rows(values_only=True):
        if not headers_found:
            vals = [str(c).strip() if c else "" for c in row]
            if "Equipamento" in vals or "Ponto" in vals:
                for i, v in enumerate(vals):
                    header_idx[v] = i
                headers_found = True
            continue
        try:
            equipamento = row[header_idx["Equipamento"]]
            if not equipamento:
                continue
            tag = str(equipamento).strip()
            machine = await db.machines.find_one({"tag": tag})
            if not machine:
                # create a stub machine
                machine = {
                    "id": str(uuid.uuid4()),
                    "tag": tag,
                    "local": "",
                    "equipamento": tag,
                    "descricao": "",
                    "tipo": "vibracao",
                    "criticidade": "Média",
                    "status": "OK",
                    "created_at": now_iso(),
                }
                await db.machines.insert_one(machine)
            valor = float(row[header_idx["Valor"]]) if row[header_idx["Valor"]] is not None else 0.0
            doc = {
                "id": str(uuid.uuid4()),
                "machine_id": machine["id"],
                "machine_tag": tag,
                "subconjunto": str(row[header_idx.get("Subconjunto", -1)] or "") if header_idx.get("Subconjunto", -1) >= 0 else "",
                "ponto": str(row[header_idx.get("Ponto", -1)] or "") if header_idx.get("Ponto", -1) >= 0 else "",
                "valor": valor,
                "unidade": str(row[header_idx.get("Unidade", -1)] or "") if header_idx.get("Unidade", -1) >= 0 else "",
                "deteccao": str(row[header_idx.get("Detecção", -1)] or "") if header_idx.get("Detecção", -1) >= 0 else "",
                "data": now_iso(),
            }
            await db.measurements.insert_one(doc)
            inserted += 1
        except Exception as ex:
            logger.warning("Skip measurement: %s", ex)
    return {"inserted": inserted}

@api.post("/measurements")
async def create_measurement(payload: MeasurementModel, user=Depends(require_editor)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["data"] = now_iso()
    await db.measurements.insert_one(doc)
    doc.pop("_id", None)
    return doc

# ============== Dashboard ==============
@api.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    machines = await db.machines.find({}, {"_id": 0}).to_list(10000)
    diagnostics = await db.diagnostics.find({}, {"_id": 0}).to_list(5000)
    total = len(machines)
    status_dist = {"OK": 0, "A1": 0, "A2": 0, "Parado": 0}
    for m in machines:
        s = m.get("status", "OK")
        status_dist[s] = status_dist.get(s, 0) + 1

    # Health index (weighted)
    weight = {"OK": 100, "A1": 70, "A2": 40, "Parado": 0}
    if total:
        health = sum(weight.get(m.get("status", "OK"), 0) for m in machines) / total
    else:
        health = 100

    # Top defects (from diagnostics)
    defect_counter: Dict[str, int] = {}
    for d in diagnostics:
        for did in d.get("defect_ids", []):
            defect_counter[did] = defect_counter.get(did, 0) + 1
    defects = await db.defects.find({}, {"_id": 0}).to_list(2000)
    id_to_name = {d["id"]: d["nome"] for d in defects}
    top_defects = sorted(
        [{"nome": id_to_name.get(k, k), "count": v} for k, v in defect_counter.items()],
        key=lambda x: x["count"], reverse=True
    )[:10]

    # Monthly evolution (last 6 months)
    months: Dict[str, Dict[str, int]] = {}
    for d in diagnostics:
        try:
            dt = datetime.fromisoformat(d["data"].replace("Z", "+00:00"))
            key = dt.strftime("%Y-%m")
            months.setdefault(key, {"OK": 0, "A1": 0, "A2": 0, "Parado": 0})
            months[key][d.get("status", "A1")] = months[key].get(d.get("status", "A1"), 0) + 1
        except Exception:
            pass
    monthly = [{"month": k, **v} for k, v in sorted(months.items())][-6:]

    # Failure probability ranking
    crit_w = {"Alta": 3, "Média": 2, "Baixa": 1}
    status_w = {"OK": 0, "A1": 30, "A2": 70, "Parado": 100}
    ranking = []
    for m in machines:
        score = status_w.get(m.get("status", "OK"), 0) * crit_w.get(m.get("criticidade", "Média"), 2)
        ranking.append({"tag": m.get("tag"), "equipamento": m.get("equipamento", ""), "local": m.get("local", ""), "status": m.get("status"), "criticidade": m.get("criticidade"), "score": score})
    ranking = sorted(ranking, key=lambda x: x["score"], reverse=True)[:10]

    return {
        "total_machines": total,
        "status_dist": status_dist,
        "health_index": round(health, 1),
        "top_defects": top_defects,
        "monthly_evolution": monthly,
        "failure_ranking": ranking,
        "total_diagnostics": len(diagnostics),
    }

# ============== Reports ==============
@api.get("/reports/summary")
async def report_summary(user=Depends(get_current_user)):
    """Resumo executivo: KPIs + status + top defeitos."""
    machines = await db.machines.find({}, {"_id": 0}).to_list(10000)
    diagnostics = await db.diagnostics.find({}, {"_id": 0}).sort("data", -1).to_list(5000)
    defects = await db.defects.find({}, {"_id": 0}).to_list(2000)
    id_to_name = {d["id"]: d["nome"] for d in defects}
    status_dist = {"OK": 0, "A1": 0, "A2": 0, "Parado": 0}
    for m in machines:
        status_dist[m.get("status", "OK")] = status_dist.get(m.get("status", "OK"), 0) + 1
    weight = {"OK": 100, "A1": 70, "A2": 40, "Parado": 0}
    health = sum(weight.get(m.get("status", "OK"), 0) for m in machines) / max(len(machines), 1)
    defect_counter: Dict[str, int] = {}
    for d in diagnostics:
        for did in d.get("defect_ids", []):
            defect_counter[did] = defect_counter.get(did, 0) + 1
    top_defects = sorted(
        [{"nome": id_to_name.get(k, k), "count": v} for k, v in defect_counter.items()],
        key=lambda x: x["count"], reverse=True,
    )[:5]
    critical = [
        {"tag": m.get("tag"), "equipamento": m.get("equipamento", ""), "local": m.get("local", ""), "status": m.get("status")}
        for m in machines if m.get("status") in ("A2", "Parado")
    ]
    return {
        "generated_at": now_iso(),
        "total_machines": len(machines),
        "status_dist": status_dist,
        "health_index": round(health, 1),
        "top_defects": top_defects,
        "critical_machines": critical,
        "total_diagnostics": len(diagnostics),
    }

@api.get("/reports/complete")
async def report_complete(user=Depends(get_current_user)):
    """Relatório completo: tudo do resumo + lista de todos os diagnósticos com detalhes."""
    summary = await report_summary(user)
    diagnostics = await db.diagnostics.find({}, {"_id": 0}).sort("data", -1).to_list(5000)
    machines = await db.machines.find({}, {"_id": 0}).to_list(10000)
    machine_map = {m["id"]: m for m in machines}
    enriched = []
    for d in diagnostics:
        m = machine_map.get(d.get("machine_id"), {})
        enriched.append({**d, "equipamento": m.get("equipamento", ""), "local": m.get("local", ""), "criticidade": m.get("criticidade", "")})
    return {**summary, "diagnostics": enriched, "machines": machines}

@api.get("/machines/{machine_id}/history")
async def machine_history(machine_id: str, user=Depends(get_current_user)):
    diags = await db.diagnostics.find({"machine_id": machine_id}, {"_id": 0}).sort("data", 1).to_list(1000)
    return diags


# ============== Mount ==============
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
