import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import toast from 'react-hot-toast';
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { auth } from "../../utils/api";

const DepartmentSignup = () => {
  const { companySlug, departmentSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [departmentInfo, setDepartmentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    departmentRole: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.debug('DepartmentSignup params', { companySlug, departmentSlug, pathname: location.pathname });
    if (!companySlug || !departmentSlug || companySlug === 'undefined' || departmentSlug === 'undefined') {
      setErrors({ general: 'This signup link is malformed. Please request a new link from your admin.' });
      setLoading(false);
      return;
    }
    fetchDepartmentInfo();
  }, [companySlug, departmentSlug, location.pathname]);

  const fetchDepartmentInfo = async () => {
    try {
      const response = await auth.getDepartmentSignupInfoBySlug(companySlug, departmentSlug);
      setDepartmentInfo(response.data);
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Invalid department signup link";
      setErrors({ general: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!formData.departmentRole.trim()) {
      newErrors.departmentRole = "Department role is required";
    } else if (formData.departmentRole.trim().length < 2) {
      newErrors.departmentRole = "Role must be at least 2 characters";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password =
        "Password must contain uppercase, lowercase, and number";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await auth.registerDepartmentUserBySlug(companySlug, departmentSlug, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        departmentRole: formData.departmentRole.trim(),
      });

      // Store the JWT token
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      toast.success(`Welcome ${response.data.user.name}! Account created successfully.`);
      
      // Redirect to dashboard
      navigate("/dashboard");
    } catch (error) {
      if (error.response?.data?.errors) {
        // Handle validation errors
        const fieldErrors = {};
        error.response.data.errors.forEach((err) => {
          fieldErrors[err.path] = err.msg;
        });
        setErrors(fieldErrors);
        toast.error('Please fix the form errors and try again');
      } else {
        const errorMessage = error.response?.data?.error || "Registration failed";
        setErrors({ general: errorMessage });
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!departmentInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <Card.Header>
            <h1 className="text-2xl font-bold text-center text-red-600">
              Invalid Link
            </h1>
          </Card.Header>
          <Card.Content>
            <p className="text-center text-gray-600 mb-4">
              {errors.general || "This department signup link is not valid."}
            </p>
            <Button onClick={() => navigate("/login")} className="w-full">
              Go to Login
            </Button>
          </Card.Content>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <Card.Header>
          <h1 className="text-2xl font-bold text-center text-gray-900">
            Join Department
          </h1>
          <div className="text-center text-gray-600">
            <p className="font-medium">{departmentInfo.departmentName}</p>
            <p className="text-sm">{departmentInfo.companyName}</p>
          </div>
        </Card.Header>
        <Card.Content>
          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Full Name
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleInputChange}
                className={errors.name ? "border-red-500" : ""}
                placeholder="Enter your full name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                className={errors.email ? "border-red-500" : ""}
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                className={errors.password ? "border-red-500" : ""}
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={errors.confirmPassword ? "border-red-500" : ""}
                placeholder="Confirm your password"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="departmentRole"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Role in Department *
              </label>
              <Input
                id="departmentRole"
                name="departmentRole"
                type="text"
                value={formData.departmentRole}
                onChange={handleInputChange}
                placeholder="e.g., Senior Developer, Project Manager, Designer"
                className={errors.departmentRole ? "border-red-500" : ""}
                required
              />
              {errors.departmentRole && (
                <p className="mt-1 text-sm text-red-600">{errors.departmentRole}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Specify your role or position within the department
              </p>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Department head?
                </span>
              </div>
            </div>

            <div className="mt-3">
              <button
                onClick={() => navigate(`/${companySlug}/${departmentSlug}/signup-head`)}
                className="w-full text-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                👑 Join as Department Head
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-blue-600 hover:text-blue-500 font-medium"
              >
                Sign in
              </button>
            </p>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};

export default DepartmentSignup;
