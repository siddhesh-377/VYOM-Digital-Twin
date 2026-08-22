"""Measure effective time rate through the real run() loop."""
import sys, os, asyncio, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from simulation.loop import MissionSimulation

async def main():
    mult = int(sys.argv[1]) if len(sys.argv) > 1 else 6000
    sim = MissionSimulation("rate-test", {"initial_alt_km": 650})
    sim.time_multiplier = mult
    sim.broadcast_callback = None
    task = asyncio.create_task(sim.run())
    t0 = time.time()
    await asyncio.sleep(10)
    wall = time.time() - t0
    sim.running = False
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    sim_days = sim.mission_day
    print(f"mult={mult} wall={wall:.2f}s sim_days={sim_days:.4f} "
          f"effective_rate={sim_days*86400/wall:.0f}x")

asyncio.run(main())
