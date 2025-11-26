import {
  addHistory,
  applyExit,
  applyMove,
  findInventoryByLocation,
} from "../../../../lib/movements.js";
import { loadRoute } from "../../../../lib/separation.js";
import { ensureAdminAuth } from "../../../../lib/admin.js";
import { refreshKvSnapshot } from "../../../../lib/snapshot.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

async function runInTransaction(env, fn) {
  await env.DB.prepare("BEGIN TRANSACTION").run();
  try {
    const result = await fn();
    await env.DB.prepare("COMMIT").run();
    return result;
  } catch (err) {
    await env.DB.prepare("ROLLBACK").run();
    throw err;
  }
}

async function markRouteStatus(env, routeId, status) {
  await env.DB.prepare(
    "UPDATE separation_routes SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?"
  )
    .bind(status, routeId)
    .run();
}

async function markStepStatus(env, stepId, status) {
  await env.DB.prepare(
    "UPDATE separation_route_steps SET status=? WHERE id=?"
  )
    .bind(status, stepId)
    .run();
}

async function processStep(env, step, simulate) {
  if (step.status !== "pending") return { step, status: step.status };

  if (step.action === "PICK") {
    const inventory = await findInventoryByLocation(env, {
      locationId: step.from_location,
      productId: step.product_id,
    });

    if (!inventory || inventory.quantity < step.quantity) {
      throw new Error(
        `estoque insuficiente para PICK em ${step.from_location} (produto ${step.product_id})`
      );
    }

    if (!simulate) {
      await applyExit(env, { inventoryId: inventory.id, quantity: step.quantity });
      await addHistory(env, "saida", JSON.stringify({
        reason: "pick",
        routeId: step.route_id,
        stepId: step.id,
        locationId: step.from_location,
        productId: step.product_id,
        quantity: step.quantity,
      }));
      await markStepStatus(env, step.id, "done");
    }

    return { step, status: simulate ? "pending" : "done" };
  }

  if (step.action?.startsWith("MOVE")) {
    const inventory = await findInventoryByLocation(env, {
      locationId: step.from_location,
      productId: step.product_id,
    });

    if (!inventory || inventory.quantity < step.quantity) {
      throw new Error(
        `estoque insuficiente para mover de ${step.from_location} (produto ${step.product_id})`
      );
    }

    if (!simulate) {
      await applyMove(env, {
        fromLocationId: step.from_location,
        toLocationId: step.to_location,
        productId: step.product_id,
        quantity: step.quantity,
      });
      await addHistory(env, "movimentacao", JSON.stringify({
        reason: step.action,
        routeId: step.route_id,
        stepId: step.id,
        from: step.from_location,
        to: step.to_location,
        productId: step.product_id,
        quantity: step.quantity,
      }));
      await markStepStatus(env, step.id, "done");
    }

    return { step, status: simulate ? "pending" : "done" };
  }

  return { step, status: step.status };
}

export async function onRequestPost({ request, env, params }) {
  try {
    const { kv, response } = await ensureAdminAuth(request, env);
    if (response) return response;

    const payload = await request.json().catch(() => ({}));
    const simulate = Boolean(payload.simulate);
    const stepId = payload.stepId || payload.step_id;
    const markSkipped = payload.status === "skipped";

    const route = await loadRoute(env, params.id);
    if (!route) return json({ error: "rota não encontrada" }, 404);

    const steps = route.steps || [];
    const pendingSteps = steps.filter((s) => s.status === "pending");

    const targetSteps = stepId
      ? pendingSteps.filter((s) => String(s.id) === String(stepId))
      : pendingSteps;

    if (targetSteps.length === 0) {
      return json({ error: "nenhum passo pendente para confirmar" }, 400);
    }

    const executor = async () => {
      const processed = [];
      let started = false;

      if (!simulate && route.status !== "running") {
        await markRouteStatus(env, route.id, "running");
        started = true;
      }

      for (const step of targetSteps) {
        if (markSkipped) {
          if (!simulate) await markStepStatus(env, step.id, "skipped");
          processed.push({ step, status: simulate ? "pending" : "skipped" });
          continue;
        }

        const result = await processStep(env, step, simulate);
        processed.push(result);
      }

      if (!simulate) {
        const remaining = await env.DB.prepare(
          "SELECT COUNT(1) as pending FROM separation_route_steps WHERE route_id=? AND status='pending'"
        )
          .bind(route.id)
          .first();

        if (remaining && Number(remaining.pending) === 0) {
          await markRouteStatus(env, route.id, "completed");
        } else if (!started && route.status === "pending") {
          await markRouteStatus(env, route.id, "running");
        }
      }

      return processed;
    };

    const processedSteps = simulate
      ? await executor()
      : await runInTransaction(env, executor);

    const updatedRoute = await loadRoute(env, route.id);
    const snapshot = simulate ? null : await refreshKvSnapshot(env, kv);

    return json({
      simulate,
      processed: processedSteps,
      route: updatedRoute,
      snapshot,
    });
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
}
