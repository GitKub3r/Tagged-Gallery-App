const RuleModel = require("../models/Rule.model");
const AlbumModel = require("../models/Album.model");
const AuditService = require("./Audit.service");
const RuleEngineService = require("./RuleEngine.service");
const { sanitizeGraph, getGraphIssues } = require("../utils/ruleGraph");

// Una regla nueva empieza con el disparador más habitual, listo para conectarle condiciones y acciones.
const DEFAULT_GRAPH = { nodes: [{ id: "trigger-1", type: "trigger.mediaAdded", position: { x: 0, y: 0 }, config: {} }], edges: [] };

const forbidAdmin = (user) => (user.type === "admin" ? { error: "Rules are only available for library accounts", status: 403 } : null);

const validateName = (value) => {
    if (typeof value !== "string" || !value.trim()) return { error: "Rule name is required" };
    if (value.trim().length > 100) return { error: "Rule name must be at most 100 characters" };
    return { name: value.trim() };
};

// Una regla activa debe estar completa: si no, se guardaría activa pero nunca haría nada.
const checkActivation = async (isActive, graph, userId) => {
    if (!isActive) return null;
    const issues = getGraphIssues(graph, { albumIds: new Set(await AlbumModel.findIdsByUserId(userId)) });
    return issues.length > 0 ? { error: `Finish the workflow before activating the rule: ${issues[0].message.toLowerCase()}`, status: 400 } : null;
};

class RuleService {
    static async getAll(user) {
        return forbidAdmin(user) || { data: await RuleModel.findAllByUserId(user.id) };
    }

    static async getById(id, user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        const rule = await RuleModel.findByIdForUser(id, user.id);
        return rule ? { data: rule } : { error: "Rule not found", status: 404 };
    }

    static async create(body, user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        const { name, error } = validateName(body?.name);
        if (error) return { error, status: 400 };

        const { data: graph, error: graphError } = body?.graph === undefined ? { data: DEFAULT_GRAPH } : sanitizeGraph(body.graph);
        if (graphError) return { error: graphError, status: 400 };
        const isActive = body?.is_active === true;
        const activationError = await checkActivation(isActive, graph, user.id);
        if (activationError) return activationError;

        return { data: await RuleModel.create(user.id, { name, is_active: isActive, graph }) };
    }

    // Admite cambios parciales (p. ej. solo is_active desde el listado): lo que no llega se conserva.
    static async update(id, body, user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        const existing = await RuleModel.findByIdForUser(id, user.id);
        if (!existing) return { error: "Rule not found", status: 404 };

        const { name, error } = body?.name === undefined ? { name: existing.name } : validateName(body.name);
        if (error) return { error, status: 400 };
        if (body?.is_active !== undefined && typeof body.is_active !== "boolean") return { error: "is_active must be a boolean", status: 400 };
        const { data: graph, error: graphError } = body?.graph === undefined ? { data: existing.graph } : sanitizeGraph(body.graph);
        if (graphError) return { error: graphError, status: 400 };
        const isActive = body?.is_active ?? existing.is_active;
        const activationError = await checkActivation(isActive, graph, user.id);
        if (activationError) return activationError;

        return { data: await RuleModel.update(id, user.id, { name, is_active: isActive, graph }) };
    }

    static async delete(id, user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        const deleted = await RuleModel.delete(id, user.id);
        return deleted ? { data: null } : { error: "Rule not found", status: 404 };
    }

    static async run(id, user, req) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        const rule = await RuleModel.findByIdForUser(id, user.id);
        if (!rule) return { error: "Rule not found", status: 404 };

        const result = await RuleEngineService.runOnLibrary(rule, user.id);
        if (result.data) {
            await AuditService.logEvent({
                actionCode: "RULE_RUN",
                req,
                statusCode: 200,
                message: `Ran rule "${rule.name}" on ${result.data.processedCount} media (${result.data.changedCount} changed)`,
                metadata: { ruleId: rule.id, ...result.data },
            });
        }
        return result;
    }
}

module.exports = RuleService;
