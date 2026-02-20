import React from 'react';

const ProjectsView = React.memo(({
  projects,
  projectsLoading,
  projectsError,
  onOpenProject,
  onRenameProject,
  onArchiveProject,
  onNewProject,
}) => (
  <div className="w-full max-w-4xl">
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-bold text-gray-800">Projetos em andamento</h2>
      <button
        type="button"
        className="px-3 py-2 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
        onClick={onNewProject}
      >
        Novo Projeto
      </button>
    </div>

    {projectsLoading && <div className="text-sm text-gray-500">Carregando projetos...</div>}
    {projectsError && <div className="text-sm text-red-600">{projectsError}</div>}

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {projects.map((project) => (
        <div key={project.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-800">{project.name}</div>
          {project.description && <div className="text-xs text-gray-500 mt-1">{project.description}</div>}
          <div className="text-[10px] text-gray-400 mt-2">
            Atualizado em {new Date(project.updatedAt).toLocaleDateString()}
          </div>
          <div className="text-[10px] text-gray-400">Cards: {project.cardCount ?? 0}</div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              className="px-2 py-1 text-[10px] font-semibold rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
              onClick={() => onOpenProject(project.id)}
            >
              Abrir
            </button>
            <button
              type="button"
              className="px-2 py-1 text-[10px] font-semibold rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
              onClick={() => onRenameProject(project.id)}
            >
              Renomear
            </button>
            <button
              type="button"
              className="px-2 py-1 text-[10px] font-semibold rounded border border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => onArchiveProject(project.id)}
            >
              Arquivar
            </button>
          </div>
        </div>
      ))}
      {!projectsLoading && projects.length === 0 && (
        <div className="text-sm text-gray-500">Nenhum projeto em andamento.</div>
      )}
    </div>
  </div>
));

ProjectsView.displayName = 'ProjectsView';
export default ProjectsView;
