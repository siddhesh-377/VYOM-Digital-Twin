"""Tests for Pydantic request/response schemas."""
import pytest
from pydantic import ValidationError

from core.schemas import (
    MissionCreateSchema,
    FaultInjectSchema,
    CommandSubmitSchema,
    CrewMemberSchema,
)


class TestMissionCreateSchema:
    def test_minimal_payload(self):
        mission = MissionCreateSchema(name="Test Mission")
        assert mission.type == "orbital"
        assert mission.destination == "earth-orbit"
        assert mission.budgetCrore == 0.0
        assert mission.crew == []
        assert mission.createdAt > 0

    def test_requires_name(self):
        with pytest.raises(ValidationError):
            MissionCreateSchema(name="")

    def test_crew_members(self):
        crew = [CrewMemberSchema(id="A1", name="Astro", role="Commander")]
        mission = MissionCreateSchema(name="M", crew=crew)
        assert mission.crew[0].heartRateBpm == 72

    def test_launch_site_defaults(self):
        mission = MissionCreateSchema(name="M")
        assert mission.launchSite.name == "Satish Dhawan Space Centre (SLP)"
        assert mission.launchSite.agency == "ISRO"


class TestFaultInjectSchema:
    def test_defaults(self):
        payload = FaultInjectSchema(fault_type="solar_storm")
        assert payload.severity == 7.5
        assert payload.seed is None

    def test_severity_numeric(self):
        payload = FaultInjectSchema(fault_type="x", severity=3.2)
        assert payload.severity == 3.2

    def test_severity_string_coerced(self):
        payload = FaultInjectSchema(fault_type="x", severity="8.5")
        assert payload.severity == 8.5

    def test_severity_bool_coerced_to_number(self):
        # Pydantic coerces bool to float for numeric fields
        payload = FaultInjectSchema(fault_type="x", severity=True)
        assert payload.severity == 1.0

    def test_severity_invalid_string_rejected(self):
        with pytest.raises(ValidationError):
            FaultInjectSchema(fault_type="x", severity="abc")

    def test_requires_fault_type(self):
        with pytest.raises(ValidationError):
            FaultInjectSchema()


class TestCommandSubmitSchema:
    def test_defaults(self):
        cmd = CommandSubmitSchema(command_type="SAFE_MODE_ENABLE")
        assert cmd.params == {}