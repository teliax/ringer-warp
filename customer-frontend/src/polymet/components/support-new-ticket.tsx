import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PlusIcon,
  UploadIcon,
  FileIcon,
  XIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from "lucide-react";
import { mockSupportCategories } from "@/polymet/data/support-mock-data";

interface NewTicketData {
  title: string;
  description: string;
  category: string;
  priority: string;
  tags: string[];
  attachments: File[];
}

interface SupportNewTicketProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSubmit?: (ticketData: NewTicketData) => void;
}

export function SupportNewTicket({
  isOpen = false,
  onClose,
  onSubmit,
}: SupportNewTicketProps) {
  const [formData, setFormData] = useState<NewTicketData>({
    title: "",
    description: "",
    category: "",
    priority: "medium",
    tags: [],
    attachments: [],
  });
  const [newTag, setNewTag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof NewTicketData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        setErrors((prev) => ({
          ...prev,
          attachments: `File ${file.name} is too large (max 10MB)`,
        }));
        return false;
      }
      if (!allowedTypes.includes(file.type)) {
        setErrors((prev) => ({
          ...prev,
          attachments: `File ${file.name} has unsupported format`,
        }));
        return false;
      }
      return true;
    });

    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...validFiles],
    }));

    // Clear file input
    event.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }
    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }
    if (!formData.category) {
      newErrors.category = "Category is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      onSubmit?.(formData);

      // Reset form
      setFormData({
        title: "",
        description: "",
        category: "",
        priority: "medium",
        tags: [],
        attachments: [],
      });
      setNewTag("");
      setErrors({});

      onClose?.();
    } catch (error) {
      setErrors({ submit: "Failed to create ticket. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return "🖼️";
    if (fileType === "application/pdf") return "📄";
    if (fileType.includes("spreadsheet") || fileType.includes("excel"))
      return "📊";
    if (fileType.includes("text")) return "📝";
    return "📎";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <PlusIcon className="w-5 h-5 mr-2 text-[#58C5C7]" />
            Create New Support Ticket
          </DialogTitle>
          <DialogDescription>
            Provide detailed information about your issue to help us assist you
            better
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Brief description of your issue"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              className={errors.title ? "border-red-500" : ""}
            />

            {errors.title && (
              <p className="text-sm text-red-500 flex items-center">
                <AlertCircleIcon className="w-4 h-4 mr-1" />

                {errors.title}
              </p>
            )}
          </div>

          {/* Category and Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">
                Category <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleInputChange("category", value)}
              >
                <SelectTrigger
                  className={errors.category ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {mockSupportCategories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-red-500 flex items-center">
                  <AlertCircleIcon className="w-4 h-4 mr-1" />

                  {errors.category}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => handleInputChange("priority", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Provide detailed information about your issue, including steps to reproduce, error messages, and any relevant context..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={6}
              className={errors.description ? "border-red-500" : ""}
            />

            {errors.description && (
              <p className="text-sm text-red-500 flex items-center">
                <AlertCircleIcon className="w-4 h-4 mr-1" />

                {errors.description}
              </p>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (Optional)</Label>
            <div className="flex space-x-2">
              <Input
                id="tags"
                placeholder="Add relevant tags"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />

              <Button type="button" variant="outline" onClick={addTag}>
                Add
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="flex items-center space-x-1"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-red-500"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* File Attachments */}
          <div className="space-y-2">
            <Label htmlFor="attachments">Attachments (Optional)</Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
              <div className="text-center">
                <UploadIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />

                <div className="text-sm text-muted-foreground mb-2">
                  Drag and drop files here, or click to browse
                </div>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.txt,.csv,.xls,.xlsx"
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    document.getElementById("file-upload")?.click()
                  }
                >
                  Choose Files
                </Button>
                <div className="text-xs text-muted-foreground mt-2">
                  Supported: Images, PDF, Text, CSV, Excel (Max 10MB each)
                </div>
              </div>
            </div>

            {errors.attachments && (
              <p className="text-sm text-red-500 flex items-center">
                <AlertCircleIcon className="w-4 h-4 mr-1" />

                {errors.attachments}
              </p>
            )}

            {formData.attachments.length > 0 && (
              <div className="space-y-2">
                <Label>Attached Files ({formData.attachments.length})</Label>
                <div className="space-y-2">
                  {formData.attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">
                          {getFileIcon(file.type)}
                        </span>
                        <div>
                          <div className="text-sm font-medium">{file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <XIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 flex items-center">
                <AlertCircleIcon className="w-4 h-4 mr-2" />

                {errors.submit}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-4 h-4 mr-2" />
                  Create Ticket
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
