import { useCallback, useState } from 'react';
import { apiFetch } from '../utils/api';

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  const loadProjects = useCallback(async () => {
    try {
      setProjectsLoading(true);
      setProjectsError(null);
      const payload = await apiFetch('/projects?status=in_progress');
      setProjects(payload.projects || []);
    } catch (error) {
      setProjectsError(error.message || 'Erro ao carregar projetos.');
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const createProject = useCallback(async (openProjectFn) => {
    if (!newProjectName.trim()) return;
    try {
      const payload = await apiFetch('/projects', {
        method: 'POST',
        body: {
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || null,
          status: 'in_progress',
        },
      });
      setIsProjectModalOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
      await loadProjects();
      await openProjectFn(payload.project.id);
    } catch (error) {
      alert(error.message || 'Erro ao criar projeto.');
    }
  }, [newProjectName, newProjectDescription, loadProjects]);

  const renameProject = useCallback(async (projectId) => {
    const name = window.prompt('Novo nome do projeto:');
    if (!name) return;
    try {
      await apiFetch(`/projects/${projectId}`, { method: 'PUT', body: { name } });
      await loadProjects();
    } catch (error) {
      alert(error.message || 'Erro ao renomear projeto.');
    }
  }, [loadProjects]);

  const archiveProject = useCallback(async (projectId) => {
    try {
      await apiFetch(`/projects/${projectId}/archive`, { method: 'POST' });
      await loadProjects();
    } catch (error) {
      alert(error.message || 'Erro ao arquivar projeto.');
    }
  }, [loadProjects]);

  return {
    projects,
    projectsLoading,
    projectsError,
    isProjectModalOpen,
    setIsProjectModalOpen,
    newProjectName,
    setNewProjectName,
    newProjectDescription,
    setNewProjectDescription,
    loadProjects,
    createProject,
    renameProject,
    archiveProject,
  };
}
