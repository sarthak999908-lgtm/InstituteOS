import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, Plus, Filter, ArrowUpDown, ChevronUp, ChevronDown,
  X, CheckCircle2, Phone, Mail, Edit3, Trash2, ArrowUpRight, Clock,
  Download, CheckSquare, Square
} from "lucide-react";
import GlassCard from "../components/common/GlassCard.jsx";
import MagneticButton from "../components/common/MagneticButton.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import StudentDrawer from "../components/common/Drawer.jsx";
import { INITIAL_STUDENTS } from "../data.js";
import { sound } from "../lib/sound.js";
import { toast } from "../components/common/Toast.jsx";
import { getStudents, createStudent, deleteStudent, requestAuditExport } from "../services/api.js";
import { appStorageKey } from "../lib/localDemo.js";


function loadSavedStudents(role) {
  let saved = INITIAL_STUDENTS;
  try {
    const raw = localStorage.getItem(appStorageKey("instituteos_students"));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) saved = parsed;
    }
  } catch {}

  if (role === "trainer") return saved.map(({ id, name, batch }) => ({ id, name, batch }));
  if (role === "accounts") return saved.map(({ id, name }) => ({ id, name }));
  return saved;
}

export default function StudentsPage({ role = "owner" }) {
  const canManage = role === "owner" || role === "counselor";
  const canViewContact = canManage;
  const canViewBatch = role !== "accounts";

  const [students, setStudents] = useState(() => loadSavedStudents(role));
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [density, setDensity] = useState("comfortable"); // 'comfortable' | 'compact'
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc"); // 'asc' | 'desc'
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    course: "Full Stack Development",
    batch: "Full Stack · Morning",
    status: "Active",
  });

  // Sync to localStorage
  useEffect(() => {
    if (!canManage) return;
    try {
      localStorage.setItem(appStorageKey("instituteos_students"), JSON.stringify(students));
    } catch {}
  }, [students, canManage]);

  // Fetch live students from API on mount
  useEffect(() => {
    let active = true;
    getStudents()
      .then((data) => {
        if (!active || !Array.isArray(data) || !data.length) return;
        setStudents((prev) => {
          const serverMap = new Map(data.map((s) => [s.id, {
            id: s.id,
            name: s.name,
            email: s.email || "",
            phone: s.phone || "",
            course: s.course || "Full Stack Development",
            batch: s.batch_name || s.batch || "Morning Batch",
            status: s.status || "Active",
          }]));
          const merged = [...data.map((s) => serverMap.get(s.id))];
          for (const item of prev) {
            if (!serverMap.has(item.id)) merged.push(item);
          }
          return merged;
        });
      })
      .catch((err) => {
        console.debug("Live students fetch fallback:", err.message);
      });
    return () => { active = false; };
  }, []);


  const handleSort = (field) => {
    sound.tick();
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const toggleSelectOne = (id, e) => {
    e.stopPropagation();
    sound.tick();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    sound.tick();
    if (selectedIds.size === filteredAndSorted.length && filteredAndSorted.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSorted.map((s) => s.id)));
    }
  };

  const exportSelectedCsv = async () => {
    sound.shimmer();
    const selectedList = students.filter((s) => selectedIds.has(s.id));
    if (!selectedList.length) return;
    try {
      await requestAuditExport("student_records");
    } catch (error) {
      toast.error("Export stopped", `The audit service could not record this export: ${error.message}`);
      return;
    }
    const header = ["ID", "Name", "Email", "Phone", "Course", "Batch", "Status"];
    const rows = selectedList.map((s) => [s.id, s.name, s.email, s.phone || "", s.course, s.batch || "", s.status || "Active"]);
    const csvContent = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `students_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV Exported", `${selectedList.length} student records downloaded.`);
  };

  const bulkUpdateStatus = (newStatus) => {
    sound.chime();
    setStudents((curr) =>
      curr.map((s) => (selectedIds.has(s.id) ? { ...s, status: newStatus } : s))
    );
    toast.success("Status Updated", `Marked ${selectedIds.size} students as ${newStatus}.`);
    setSelectedIds(new Set());
  };

  const filteredAndSorted = useMemo(() => {
    const q = search.toLowerCase().trim();
    let res = students.filter((s) => {
      const searchable = canViewContact
        ? [s.id, s.name, s.email, s.phone, s.course, s.batch]
        : canViewBatch
        ? [s.name, s.batch]
        : [s.name];
      const matchesSearch = searchable.some((val) =>
        String(val || "").toLowerCase().includes(q)
      );
      const matchesStatus =
        !canManage || statusFilter === "All" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    res.sort((a, b) => {
      const valA = String(a[sortField] || "").toLowerCase();
      const valB = String(b[sortField] || "").toLowerCase();
      return sortDirection === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });

    return res;
  }, [students, search, statusFilter, sortField, sortDirection, canManage, canViewContact, canViewBatch]);

  // Reset to page 1 whenever search/filter/sort changes
  useEffect(() => { setPage(1); }, [search, statusFilter, sortField, sortDirection]);

  // Paginated slice for the current page
  const totalPages = Math.ceil(filteredAndSorted.length / pageSize) || 1;
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const paginatedStudents = filteredAndSorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleOpenDrawer = (student) => {
    sound.tick();
    setSelectedStudent(student);
    setDrawerOpen(true);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (editingStudent) {
      const updated = { ...editingStudent, ...form };
      setStudents((curr) =>
        curr.map((s) => (s.id === editingStudent.id ? updated : s))
      );
      createStudent(updated).catch((err) =>
        console.debug("API update fallback to local:", err.message)
      );
      toast.success("Student Updated", `${form.name} record was saved.`);
    } else {
      const newStu = {
        ...form,
        id: `STU${Date.now().toString().slice(-6)}`,
      };
      setStudents((curr) => [newStu, ...curr]);
      createStudent(newStu).catch((err) =>
        console.debug("API create fallback to local:", err.message)
      );
      toast.success("Student Enrolled", `${form.name} was added to the directory.`);
    }

    sound.chime();
    setShowAddModal(false);
    setEditingStudent(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      course: "Full Stack Development",
      batch: "Full Stack · Morning",
      status: "Active",
    });
  };

  const handleDelete = (student, e) => {
    e.stopPropagation();
    if (window.confirm(`Delete ${student.name} from directory?`)) {
      setStudents((curr) => curr.filter((s) => s.id !== student.id));
      deleteStudent(student.id).catch((err) =>
        console.debug("API delete fallback to local:", err.message)
      );
      sound.tick();
      toast.info("Record Removed", `${student.name} was removed.`);
    }
  };


  return (
    <div className="module-page students-redesign" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-primary)", boxShadow: "0 0 8px var(--accent-primary)" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: "var(--accent-primary)", textTransform: "uppercase" }}>
              ACADEMIC REGISTRY
            </span>
          </div>

          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(1.8rem, 2.8vw, 2.4rem)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Student Directory
          </h1>

          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
            {canManage
              ? "Manage student profiles, cohorts, contact registries and dropout risk."
              : "Review student rosters and assigned batches."}
          </p>
        </div>

        {canManage && (
          <MagneticButton
            variant="primary"
            onClick={() => {
              setEditingStudent(null);
              setShowAddModal(true);
            }}
          >
            <Plus size={16} />
            Enroll Student
          </MagneticButton>
        )}
      </div>

      {/* Toolbar: Search, Filters & Density Toggle */}
      <GlassCard style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          {/* Search bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
              minWidth: 280,
              flex: 1,
            }}
          >
            <Search size={16} color="var(--accent-primary)" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={canViewContact ? "Search name, student ID, email, or course..." : "Search student name..."}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: "13px",
                width: "100%",
                fontFamily: "'Inter', sans-serif",
              }}
            />
          </div>

          {/* Controls: Status filter & Density */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {canManage && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "7px 12px",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                }}
              >
                <option value="All">All statuses</option>
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Inactive">Inactive</option>
              </select>
            )}

            {/* Density toggle: comfortable vs compact */}
            <div
              style={{
                display: "flex",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setDensity("comfortable")}
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "none",
                  background: density === "comfortable" ? "var(--surface)" : "transparent",
                  color: density === "comfortable" ? "var(--text-primary)" : "var(--text-muted)",
                  boxShadow: density === "comfortable" ? "0 1px 2px rgba(15, 23, 42, 0.06)" : "none",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Comfortable
              </button>
              <button
                type="button"
                onClick={() => setDensity("compact")}
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "none",
                  background: density === "compact" ? "var(--surface)" : "transparent",
                  color: density === "compact" ? "var(--text-primary)" : "var(--text-muted)",
                  boxShadow: density === "compact" ? "0 1px 2px rgba(15, 23, 42, 0.06)" : "none",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Compact
              </button>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Polished Table */}
      <GlassCard style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", maxHeight: "65vh" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            {/* Sticky Header with Backdrop Blur */}
            <thead
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                background: "var(--surface)",
                backdropFilter: "blur(20px)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <tr>
                {canManage && (
                  <th style={{ width: 38, padding: "14px 10px 14px 16px" }}>
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: selectedIds.size > 0 && selectedIds.size === filteredAndSorted.length ? "var(--accent-primary)" : "var(--text-muted)",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                        padding: 0,
                      }}
                      title="Select all students"
                      aria-label="Select all students"
                    >
                      {selectedIds.size > 0 && selectedIds.size === filteredAndSorted.length ? (
                        <CheckSquare size={16} />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                )}

                <th
                  onClick={() => handleSort("name")}
                  style={{ padding: density === "comfortable" ? "14px 18px" : "10px 14px", cursor: "pointer", userSelect: "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent-primary)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    <span>Student</span>
                    {sortField === "name" && (
                      <motion.span animate={{ rotate: sortDirection === "desc" ? 180 : 0 }}>
                        <ChevronUp size={14} />
                      </motion.span>
                    )}
                  </div>
                </th>

                {canViewContact && (
                  <>
                    <th style={{ padding: density === "comfortable" ? "14px 18px" : "10px 14px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      ID
                    </th>
                    <th style={{ padding: density === "comfortable" ? "14px 18px" : "10px 14px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Course & Batch
                    </th>
                    <th style={{ padding: density === "comfortable" ? "14px 18px" : "10px 14px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Contact
                    </th>
                    <th style={{ padding: density === "comfortable" ? "14px 18px" : "10px 14px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Status
                    </th>
                    <th style={{ padding: density === "comfortable" ? "14px 18px" : "10px 14px", textAlign: "right", color: "var(--text-muted)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Actions
                    </th>
                  </>
                )}
                {!canViewContact && canViewBatch && (
                  <th style={{ padding: "14px 18px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                    Batch
                  </th>
                )}
              </tr>
            </thead>

            {/* Table Rows with Stagger Entrance and Hover Spotlight */}
            <tbody>
              {paginatedStudents.map((student, idx) => {
                const isSelected = selectedStudent?.id === student.id;
                const isChecked = selectedIds.has(student.id);
                const statusLower = (student.status || "active").toLowerCase();
                const statusDotColor =
                  statusLower === "active"
                    ? "var(--success)"
                    : statusLower === "pending"
                    ? "var(--warning)"
                    : "var(--danger)";
                const statusDotAnim =
                  statusLower === "active"
                    ? "pulse-dot-green"
                    : statusLower === "pending"
                    ? "pulse-dot-amber"
                    : "pulse-dot-red";

                return (
                  <motion.tr
                    key={student.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.02 * Math.min(idx, 20), duration: 0.2 }}
                    onClick={() => handleOpenDrawer(student)}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      background: isSelected || isChecked
                        ? "var(--accent-badge-bg)"
                        : "transparent",
                      borderLeft: isSelected || isChecked ? "3px solid var(--accent-primary)" : "3px solid transparent",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !isChecked) e.currentTarget.style.background = "var(--surface-2)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && !isChecked) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {/* Checkbox Cell for selection */}
                    {canManage && (
                      <td
                        style={{ width: 38, padding: density === "comfortable" ? "14px 10px 14px 16px" : "8px 10px 8px 16px" }}
                        onClick={(e) => toggleSelectOne(student.id, e)}
                      >
                        <button
                          type="button"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: isChecked ? "var(--accent-primary)" : "var(--text-muted)",
                            cursor: "pointer",
                            display: "grid",
                            placeItems: "center",
                            padding: 0,
                          }}
                          aria-label={`Select ${student.name}`}
                        >
                          {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </td>
                    )}

                    {/* Identity Cell */}
                    <td style={{ padding: density === "comfortable" ? "14px 18px" : "8px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: density === "comfortable" ? 36 : 28,
                            height: density === "comfortable" ? 36 : 28,
                            borderRadius: "50%",
                            background: "var(--surface-3)",
                            border: "1px solid var(--border)",
                            display: "grid",
                            placeItems: "center",
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            flexShrink: 0,
                          }}
                        >
                          {student.name
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div>
                          <strong style={{ fontSize: "13px", color: "var(--text-primary)", display: "block" }}>
                            {student.name}
                          </strong>
                          {canViewContact && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              {student.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Additional columns when user can view contact/details */}
                    {canViewContact && (
                      <>
                        <td style={{ padding: density === "comfortable" ? "14px 18px" : "8px 14px" }}>
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: "11px",
                              color: "var(--accent-primary)",
                              background: "var(--accent-badge-bg)",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            {student.id}
                          </span>
                        </td>

                        <td style={{ padding: density === "comfortable" ? "14px 18px" : "8px 14px" }}>
                          <div style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                            {student.course || "Full Stack"}
                          </div>
                          <small style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                            {student.batch || "Morning Batch"}
                          </small>
                        </td>

                        <td style={{ padding: density === "comfortable" ? "14px 18px" : "8px 14px", fontSize: "12px", color: "var(--text-secondary)" }}>
                          {student.phone || "—"}
                        </td>

                        {/* Status with animated pulsing dot */}
                        <td style={{ padding: density === "comfortable" ? "14px 18px" : "8px 14px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "3px 8px",
                              borderRadius: 14,
                              background: "var(--surface-2)",
                              border: "1px solid var(--border)",
                              fontSize: "11px",
                              fontWeight: 600,
                              color: statusDotColor,
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: statusDotColor,
                                animation: `${statusDotAnim} 1.8s infinite`,
                              }}
                            />
                            {student.status || "Active"}
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td style={{ padding: density === "comfortable" ? "14px 18px" : "8px 14px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStudent(student);
                                setForm({
                                  name: student.name,
                                  email: student.email || "",
                                  phone: student.phone || "",
                                  course: student.course || "Full Stack Development",
                                  batch: student.batch || "Full Stack · Morning",
                                  status: student.status || "Active",
                                });
                                setShowAddModal(true);
                              }}
                              style={{
                                background: "var(--surface-2)",
                                border: "1px solid var(--border)",
                                borderRadius: 6,
                                width: 28,
                                height: 28,
                                display: "grid",
                                placeItems: "center",
                                color: "var(--text-secondary)",
                                cursor: "pointer",
                              }}
                              title="Edit profile"
                            >
                              <Edit3 size={13} />
                            </button>

                            {role === "owner" && (
                              <button
                                type="button"
                                onClick={(e) => handleDelete(student, e)}
                                style={{
                                  background: "var(--danger-bg)",
                                  border: "1px solid rgba(220, 38, 38, 0.25)",
                                  borderRadius: 6,
                                  width: 28,
                                  height: 28,
                                  display: "grid",
                                  placeItems: "center",
                                  color: "var(--danger)",
                                  cursor: "pointer",
                                }}
                                title="Delete record"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}

                    {!canViewContact && canViewBatch && (
                      <td style={{ padding: "14px 18px", color: "var(--text-secondary)" }}>
                        {student.batch}
                      </td>
                    )}
                  </motion.tr>
                );
              })}

              {filteredAndSorted.length === 0 && (
                <tr>
                  <td colSpan={canViewContact ? 7 : (canViewBatch ? 2 : 1)} style={{ padding: 0 }}>
                    <EmptyState
                      type="paperplane"
                      title="No matching students"
                      description={`No students match "${search}" with status "${statusFilter}".`}
                      actionLabel="Clear Filters"
                      onAction={() => {
                        setSearch("");
                        setStatusFilter("All");
                      }}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredAndSorted.length > 0 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
          }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Showing{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredAndSorted.length)}
              </strong>{" "}
              of{" "}
              <strong style={{ color: "var(--text-primary)" }}>{filteredAndSorted.length}</strong>{" "}
              students
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Page-size selector */}
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                style={{
                  fontSize: "12px",
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
                aria-label="Rows per page"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n} / page</option>
                ))}
              </select>

              {/* Prev */}
              <button
                onClick={() => { sound.tick(); setPage((p) => Math.max(1, p - 1)); }}
                disabled={currentPage <= 1}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: currentPage <= 1 ? "transparent" : "var(--surface-2)",
                  color: currentPage <= 1 ? "var(--text-muted)" : "var(--text-primary)",
                  cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                ← Prev
              </button>

              {/* Page indicator */}
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", minWidth: 70, textAlign: "center" }}>
                Page {currentPage} / {totalPages}
              </span>

              {/* Next */}
              <button
                onClick={() => { sound.tick(); setPage((p) => Math.min(totalPages, p + 1)); }}
                disabled={currentPage >= totalPages}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: currentPage >= totalPages ? "transparent" : "var(--surface-2)",
                  color: currentPage >= totalPages ? "var(--text-muted)" : "var(--text-primary)",
                  cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Floating Multi-Select Bulk Actions Bar */}
      <AnimatePresence>
        {canManage && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "fixed",
              bottom: 28,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 90,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 18px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              boxShadow: "0 16px 40px -10px rgba(15, 23, 42, 0.2), 0 0 0 1px var(--border)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  background: "var(--accent-primary)",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 12,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {selectedIds.size}
              </span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                Selected
              </span>
            </div>

            <div style={{ width: 1, height: 20, background: "var(--border)" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={exportSelectedCsv}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Download size={13} />
                Export CSV
              </button>

              <button
                type="button"
                onClick={() => bulkUpdateStatus("Active")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(22, 163, 74, 0.2)",
                  background: "var(--success-bg)",
                  color: "var(--success)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <CheckCircle2 size={13} />
                Mark Active
              </button>

              <button
                type="button"
                onClick={() => bulkUpdateStatus("Inactive")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(220, 38, 38, 0.2)",
                  background: "var(--danger-bg)",
                  color: "var(--danger)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Mark Inactive
              </button>
            </div>

            <div style={{ width: 1, height: 20, background: "var(--border)" }} />

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                padding: 4,
                borderRadius: 6,
              }}
              title="Clear selection"
              aria-label="Clear selection"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-in Student Drawer */}
      <StudentDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        student={selectedStudent}
        role={role}
      />

      {/* Add / Edit Student Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(15, 23, 42, 0.55)",
              backdropFilter: "blur(16px)",
            }}
          >
            <GlassCard style={{ width: "92%", maxWidth: 520, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div>
                  <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--accent-primary)" }}>
                    REGISTRATION
                  </span>
                  <h2 style={{ fontSize: "20px", color: "var(--text-primary)", margin: "2px 0 0" }}>
                    {editingStudent ? "Edit Student Profile" : "Enroll New Student"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "12px", color: "var(--text-secondary)" }}>
                  Full Name *
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Pooja Verma"
                    className="cosmic-input"
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "12px", color: "var(--text-secondary)" }}>
                    Email Address *
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="student@example.com"
                      className="cosmic-input"
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "12px", color: "var(--text-secondary)" }}>
                    Phone Number
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="cosmic-input"
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "12px", color: "var(--text-secondary)" }}>
                    Course
                    <select
                      value={form.course}
                      onChange={(e) => setForm({ ...form, course: e.target.value })}
                      className="cosmic-input"
                    >
                      <option>Full Stack Development</option>
                      <option>Data Science</option>
                      <option>Product Design</option>
                      <option>Digital Marketing</option>
                    </select>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "12px", color: "var(--text-secondary)" }}>
                    Status
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="cosmic-input"
                    >
                      <option>Active</option>
                      <option>Pending</option>
                      <option>Inactive</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                  <MagneticButton variant="secondary" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </MagneticButton>
                  <MagneticButton type="submit" variant="primary">
                    {editingStudent ? "Save Changes" : "Enroll Student"}
                  </MagneticButton>
                </div>
              </form>
            </GlassCard>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
