from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db, SpacecraftArchitecture
from core.schemas import SpacecraftArchitectureSchema

router = APIRouter(prefix="/api/architectures", tags=["architectures"])


@router.get("", response_model=List[SpacecraftArchitectureSchema])
def list_architectures(db: Session = Depends(get_db)):
    """List all available spacecraft architectures."""
    return db.query(SpacecraftArchitecture).all()


@router.get("/{arch_id}", response_model=SpacecraftArchitectureSchema)
def get_architecture(arch_id: str, db: Session = Depends(get_db)):
    """Get a specific spacecraft architecture by ID."""
    arch = db.query(SpacecraftArchitecture).filter(SpacecraftArchitecture.id == arch_id).first()
    if not arch:
        raise HTTPException(404, "Architecture not found")
    return arch
