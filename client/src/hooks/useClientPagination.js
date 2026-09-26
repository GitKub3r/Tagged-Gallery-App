import { useState } from "react";

// Paginación en el cliente de una lista que ya está completa en memoria (plantillas, reglas).
// La página se ajusta si la lista se acorta; resetPage vuelve a la primera al buscar u ordenar.
export const useClientPagination = (items, pageSize) => {
    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pageItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const goToPage = (nextPage) => {
        const clampedPage = Math.max(1, Math.min(totalPages, nextPage));
        if (clampedPage === currentPage) return;
        setPage(clampedPage);
        // Como en álbumes: la nueva página empieza arriba.
        const shellContent = document.querySelector(".tagged-shell-content");
        if (shellContent instanceof HTMLElement) shellContent.scrollTo({ top: 0, left: 0, behavior: "auto" });
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    return { currentPage, totalPages, pageItems, goToPage, resetPage: () => setPage(1) };
};
