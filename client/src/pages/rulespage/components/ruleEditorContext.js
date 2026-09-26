import { createContext, useContext } from "react";

// Datos y acciones del editor que necesitan los nodos y conexiones de React Flow (que solo reciben su propio estado):
// context (álbumes para validar), tagInfo (colores y tipos de tag), reachableIds (nodos conectados a un disparador),
// editNode(id), duplicateNode(id), deleteNode(id) y deleteEdge(id).
export const RuleEditorContext = createContext(null);

export const useRuleEditor = () => useContext(RuleEditorContext);
